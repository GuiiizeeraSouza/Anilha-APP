import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import {
    type FriendRequest,
    type FriendWithTime,
    type GymCheckin,
    type Profile,
    createCheckin,
    getFriendsCheckins,
    getFriendsWithWeeklyTime,
    getIncomingRequests,
    getSentPendingReceiverIds,
    removeFriendship,
    respondToRequest,
    searchProfiles,
    sendFriendRequest,
    uploadCheckinPhoto,
} from '@/lib/friend-service';
import { Container } from '@/shared/components/container';
import { useAuthStore } from '@/store/auth-store';
import { useWorkoutStore } from '@/store/workout-store';

export default function RankingScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const completedSessions = useWorkoutStore((s) => s.completedSessions);
  const workouts = useWorkoutStore((s) => s.workouts);

  // ── Today's workout entry ─────────────────────────────────────────────────
  const TODAY_KEY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][new Date().getDay()];
  const todayEntry =
    workouts
      .flatMap((w) => w.days.filter((d) => d.weekDays.includes(TODAY_KEY)).map((d) => ({ workout: w, day: d })))
      [0] ?? null;
  const hasCompletedToday = completedSessions.some(
    (s) => new Date(s.completedAt).toDateString() === new Date().toDateString(),
  );

  const displayName =
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Atleta';

  // ── Week bounds ───────────────────────────────────────────────────────────
  const now = new Date();
  const diffToMon = now.getDay() === 0 ? -6 : 1 - now.getDay();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diffToMon);
  const weekEnd = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);

  const weekSessions = completedSessions.filter((s) => {
    const d = new Date(s.completedAt);
    return d >= monday && d < weekEnd;
  });
  const weekSeconds = weekSessions.reduce((acc, s) => acc + s.durationSeconds, 0);

  // ── Ranking state ─────────────────────────────────────────────────────────
  const [friends, setFriends] = useState<FriendWithTime[]>([]);
  const [rankLoading, setRankLoading] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sentPendingIds, setSentPendingIds] = useState<string[]>([]);
  const [sendingToId, setSendingToId] = useState<string | null>(null);

  // ── Timeline state ────────────────────────────────────────────────────────
  const [checkins, setCheckins] = useState<GymCheckin[]>([]);
  const [checkinsLoading, setCheckinsLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  async function loadData() {
    if (!user) return;
    setRankLoading(true);
    setCheckinsLoading(true);
    try {
      const [friendsData, incoming, sent, checkinsData] = await Promise.all([
        getFriendsWithWeeklyTime(user.id, monday, weekEnd),
        getIncomingRequests(user.id),
        getSentPendingReceiverIds(user.id),
        getFriendsCheckins(user.id),
      ]);
      setFriends(friendsData);
      setPendingRequests(incoming);
      setSentPendingIds(sent);
      setCheckins(checkinsData);
    } catch { /* silently fail */ } finally {
      setRankLoading(false);
      setCheckinsLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [user?.id]);

  useEffect(() => {
    if (!showSearchModal || !searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      if (!user) return;
      setSearchLoading(true);
      try {
        setSearchResults(await searchProfiles(searchQuery, user.id));
      } catch { setSearchResults([]); } finally { setSearchLoading(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery, showSearchModal]);

  async function handleRespond(requestId: string, status: 'accepted' | 'declined') {
    setRespondingId(requestId);
    try {
      await respondToRequest(requestId, status);
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (status === 'accepted') loadData();
    } catch { /* ignore */ } finally { setRespondingId(null); }
  }

  async function handleRemoveFriend(friendId: string) {
    if (!user) return;
    try {
      await removeFriendship(user.id, friendId);
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
    } catch { /* ignore */ }
  }

  async function handleSendRequest(receiverId: string) {
    if (!user) return;
    setSendingToId(receiverId);
    try {
      await sendFriendRequest(user.id, receiverId);
      setSentPendingIds((prev) => [...prev, receiverId]);
    } catch { /* ignore */ } finally { setSendingToId(null); }
  }

  async function handleCheckin() {
    if (!user) return;
    // Block check-in if workout was already completed today
    if (hasCompletedToday) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera para o check-in.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (result.canceled) return;
    setCheckingIn(true);
    const uri = result.assets[0].uri;
    try {
      let photoUrl: string | null = null;
      try {
        photoUrl = await uploadCheckinPhoto(user.id, uri);
      } catch { /* proceed without photo if upload fails */ }
      await createCheckin(user.id, photoUrl);
      const updated = await getFriendsCheckins(user.id);
      // Se o upload falhou, usa a URI local para exibir a foto nesta sessão
      if (!photoUrl && updated.length > 0 && updated[0].userId === user.id && !updated[0].photoUrl) {
        setCheckins([{ ...updated[0], photoUrl: uri }, ...updated.slice(1)]);
      } else {
        setCheckins(updated);
      }
      // Automatically start today’s workout after check-in
      if (todayEntry) {
        router.push({
          pathname: '/(app)/active-workout',
          params: {
            workoutId: todayEntry.workout.id,
            dayId: todayEntry.day.id,
            fromCheckin: 'true',
          },
        });
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível registrar o check-in.');
    } finally {
      setCheckingIn(false);
    }
  }

  const rankingEntries = [
    {
      id: 'me',
      name: displayName,
      weeklySeconds: weekSeconds,
      isMe: true,
      avatarUrl: user?.user_metadata?.avatar_url as string | undefined,
    },
    ...friends.map((f) => ({
      id: f.id,
      name: f.name,
      weeklySeconds: f.weeklySeconds,
      isMe: false,
      avatarUrl: f.avatarUrl,
    })),
  ].sort((a, b) => b.weeklySeconds - a.weeklySeconds);
  const maxRankSeconds = Math.max(...rankingEntries.map((e) => e.weeklySeconds), 1);

  function formatRelativeTime(isoDate: string) {
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `há ${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `há ${hrs}h`;
    return `há ${Math.floor(hrs / 24)}d`;
  }

  return (
    <Container safe={false}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 56,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: '#2A2A2A',
          backgroundColor: '#121212',
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={{
            width: 38, height: 38, borderRadius: 19,
            backgroundColor: '#1E1E1E',
            borderWidth: 1, borderColor: '#2A2A2A',
            alignItems: 'center', justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Text style={{ color: '#D62828', fontSize: 20, fontWeight: 'bold' }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', flex: 1 }}>
          🏆 Ranking & Social
        </Text>
        {pendingRequests.length > 0 && (
          <View style={{
            backgroundColor: '#D62828', borderRadius: 10, minWidth: 20, height: 20,
            alignItems: 'center', justifyContent: 'center', marginRight: 10, paddingHorizontal: 6,
          }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{pendingRequests.length}</Text>
          </View>
        )}
        <TouchableOpacity
          onPress={loadData}
          activeOpacity={0.7}
          disabled={rankLoading}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ color: rankLoading ? '#3A3A3A' : '#D62828', fontSize: 20, fontWeight: 'bold' }}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Ranking Semanal ────────────────────────────────────────────── */}
        <View style={{
          backgroundColor: '#161616', borderRadius: 16,
          borderWidth: 1, borderColor: '#2A2A2A',
          marginBottom: 24, overflow: 'hidden',
        }}>
          {/* Card header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
            borderBottomWidth: 1, borderBottomColor: '#2A2A2A',
          }}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>🏆</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' }}>Ranking Semanal</Text>
              <Text style={{ color: '#707070', fontSize: 12, marginTop: 2 }}>Tempo de academia esta semana</Text>
            </View>
          </View>

          {/* Pending friend requests */}
          {pendingRequests.length > 0 && (
            <View style={{
              paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
              borderBottomWidth: 1, borderBottomColor: '#2A2A2A',
            }}>
              <Text style={{
                color: '#707070', fontSize: 11, fontWeight: 'bold',
                textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
              }}>
                Pedidos recebidos
              </Text>
              {pendingRequests.map((req) => (
                <View key={req.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>
                      {req.senderName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '500', flex: 1 }} numberOfLines={1}>
                    {req.senderName}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRespond(req.id, 'accepted')}
                    activeOpacity={0.8}
                    disabled={respondingId === req.id}
                    style={{ backgroundColor: '#4CAF5033', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#4CAF5055' }}
                  >
                    <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: 'bold' }}>✓ Aceitar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleRespond(req.id, 'declined')}
                    activeOpacity={0.8}
                    disabled={respondingId === req.id}
                    style={{ backgroundColor: '#D6282822', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#D6282844' }}
                  >
                    <Text style={{ color: '#D62828', fontSize: 12 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Ranking list */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
            {rankLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <ActivityIndicator color="#D62828" size="small" />
              </View>
            ) : (
              rankingEntries.map((entry, index) => {
                const pct = maxRankSeconds > 0 ? entry.weeklySeconds / maxRankSeconds : 0;
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;
                const h = Math.floor(entry.weeklySeconds / 3600);
                const m = Math.floor((entry.weeklySeconds % 3600) / 60);
                const timeLabel = entry.weeklySeconds === 0
                  ? '—'
                  : h > 0
                  ? `${h}h ${m.toString().padStart(2, '0')}m`
                  : `${m}m`;
                return (
                  <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    {medal ? (
                      <Text style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{medal}</Text>
                    ) : (
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#707070', fontSize: 12, fontWeight: 'bold' }}>{index + 1}</Text>
                      </View>
                    )}
                    <View style={{
                      width: 34, height: 34, borderRadius: 17, overflow: 'hidden',
                      borderWidth: entry.isMe ? 2 : 1,
                      borderColor: entry.isMe ? '#D62828' : '#2A2A2A',
                    }}>
                      {entry.avatarUrl ? (
                        <Image
                          source={{ uri: entry.avatarUrl }}
                          style={{ width: '100%', height: '100%' }}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <View style={{ flex: 1, backgroundColor: entry.isMe ? '#D62828' : '#2A2A2A', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>
                            {entry.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontSize: 14, fontWeight: '600', marginBottom: 4, color: entry.isMe ? '#D62828' : '#FFFFFF' }}
                        numberOfLines={1}
                      >
                        {entry.name}{entry.isMe ? ' (você)' : ''}
                      </Text>
                      <View style={{ height: 6, backgroundColor: '#2A2A2A', borderRadius: 3, overflow: 'hidden' }}>
                        <View style={{
                          width: `${Math.round(pct * 100)}%`,
                          height: '100%',
                          borderRadius: 3,
                          backgroundColor: entry.isMe ? '#D62828' : '#3A3A3A',
                          minWidth: pct > 0 ? 4 : 0,
                        }} />
                      </View>
                    </View>
                    <Text style={{ color: entry.isMe ? '#D62828' : '#707070', fontSize: 12, fontWeight: 'bold', minWidth: 36, textAlign: 'right' }}>
                      {timeLabel}
                    </Text>
                    {!entry.isMe && (
                      <TouchableOpacity
                        onPress={() => handleRemoveFriend(entry.id)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={{ color: '#505050', fontSize: 12 }}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
            {!rankLoading && friends.length === 0 && (
              <Text style={{ color: '#505050', fontSize: 13, textAlign: 'center', paddingBottom: 8 }}>
                Adicione amigos para competir no ranking! 💪
              </Text>
            )}
          </View>

          {/* Search button */}
          <TouchableOpacity
            onPress={() => { setShowSearchModal(true); setSearchQuery(''); setSearchResults([]); }}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 8, marginHorizontal: 16, marginBottom: 16, marginTop: 4,
              height: 42, borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 12,
            }}
          >
            <Text style={{ color: '#D62828', fontSize: 15 }}>🔍</Text>
            <Text style={{ color: '#A0A0A0', fontSize: 14, fontWeight: '500' }}>Buscar amigo pelo nome</Text>
          </TouchableOpacity>
        </View>

        {/* ── Timeline da Academia ────────────────────────────────────────── */}
        <View>
          {/* Section header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', flex: 1 }}>
              📸 Timeline da Academia
            </Text>
            {hasCompletedToday ? (
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: '#1E1E1E', borderRadius: 20,
                  paddingHorizontal: 14, paddingVertical: 8,
                  borderWidth: 1, borderColor: '#3A3A3A',
                }}
              >
                <Text style={{ color: '#707070', fontSize: 13, fontWeight: 'bold' }}>
                  ✅ Treino concluído hoje!
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleCheckin}
                activeOpacity={0.85}
                disabled={checkingIn}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: '#D62828', borderRadius: 20,
                  paddingHorizontal: 14, paddingVertical: 8,
                  opacity: checkingIn ? 0.6 : 1,
                }}
              >
                {checkingIn ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>📷 Check-in</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {checkinsLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator color="#D62828" size="large" />
            </View>
          ) : checkins.length === 0 ? (
            <View style={{
              backgroundColor: '#161616', borderRadius: 16,
              borderWidth: 1, borderColor: '#2A2A2A',
              padding: 36, alignItems: 'center',
            }}>
              <Text style={{ fontSize: 44, marginBottom: 12 }}>🏋️</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 'bold', marginBottom: 6 }}>
                Nenhum check-in ainda
              </Text>
              <Text style={{ color: '#505050', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                Chegou na academia? Tire uma foto{'\n'}e marque sua presença!
              </Text>
            </View>
          ) : (
            checkins.map((item) => (
              <View
                key={item.id}
                style={{
                  backgroundColor: '#161616', borderRadius: 16,
                  borderWidth: 1, borderColor: '#2A2A2A',
                  marginBottom: 12, overflow: 'hidden',
                }}
              >
                {/* User info row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}>
                  <View style={{
                    width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
                    borderWidth: 2,
                    borderColor: item.userId === user?.id ? '#D62828' : '#2A2A2A',
                  }}>
                    {item.userAvatarUrl ? (
                      <Image
                        source={{ uri: item.userAvatarUrl }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <View style={{
                        flex: 1,
                        backgroundColor: item.userId === user?.id ? '#D62828' : '#2A2A2A',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                          {item.userName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: item.userId === user?.id ? '#D62828' : '#FFFFFF', fontWeight: 'bold', fontSize: 14 }}>
                      {item.userId === user?.id ? `${item.userName} (você)` : item.userName}
                    </Text>
                    <Text style={{ color: '#505050', fontSize: 12, marginTop: 2 }}>
                      chegou na academia 🏋️ · {formatRelativeTime(item.createdAt)}
                    </Text>
                  </View>
                </View>

                {/* Photo */}
                {item.photoUrl && (
                  <Image
                    source={{ uri: item.photoUrl }}
                    style={{ width: '100%', aspectRatio: 4 / 3 }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                )}

                {/* Caption */}
                {item.caption ? (
                  <View style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
                    <Text style={{ color: '#C0C0C0', fontSize: 13, lineHeight: 19 }}>{item.caption}</Text>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* ── Search friends modal ─────────────────────────────────────────── */}
      <Modal
        visible={showSearchModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSearchModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: '#0F0F0F',
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            borderWidth: 1, borderColor: '#2A2A2A',
            maxHeight: '82%', paddingBottom: 36,
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' }}>
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16, flex: 1 }}>Buscar amigos</Text>
              <TouchableOpacity
                onPress={() => setShowSearchModal(false)}
                activeOpacity={0.7}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#1E1E1E', borderWidth: 1, borderColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: '#A0A0A0' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Input */}
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
              <TextInput
                autoFocus
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Digite o nome do usuário..."
                placeholderTextColor="#505050"
                style={{
                  height: 44, backgroundColor: '#1A1A1A',
                  borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A',
                  paddingHorizontal: 14, color: '#FFFFFF', fontSize: 15,
                }}
              />
            </View>

            {/* Results */}
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {searchLoading ? (
                <View style={{ alignItems: 'center', paddingVertical: 28 }}>
                  <ActivityIndicator color="#D62828" size="small" />
                  <Text style={{ color: '#505050', fontSize: 13, marginTop: 10 }}>Buscando...</Text>
                </View>
              ) : searchQuery.trim().length === 0 ? (
                <Text style={{ color: '#3A3A3A', fontSize: 13, textAlign: 'center', paddingVertical: 28 }}>
                  Digite um nome para buscar
                </Text>
              ) : searchResults.length === 0 ? (
                <Text style={{ color: '#505050', fontSize: 13, textAlign: 'center', paddingVertical: 28 }}>
                  Nenhum usuário encontrado.
                </Text>
              ) : (
                searchResults.map((profile) => {
                  const isFriend = friends.some((f) => f.id === profile.id);
                  const isPendingSent = sentPendingIds.includes(profile.id);
                  const pendingReceivedReq = pendingRequests.find((r) => r.senderId === profile.id);
                  const isSending = sendingToId === profile.id;
                  return (
                    <View
                      key={profile.id}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' }}
                    >
                      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                          {profile.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={{ color: '#FFFFFF', fontSize: 15, flex: 1, fontWeight: '500' }} numberOfLines={1}>
                        {profile.name}
                      </Text>
                      {isFriend ? (
                        <View style={{ backgroundColor: '#4CAF5022', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#4CAF5044' }}>
                          <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: 'bold' }}>Amigos ✓</Text>
                        </View>
                      ) : pendingReceivedReq ? (
                        <TouchableOpacity
                          onPress={() => handleRespond(pendingReceivedReq.id, 'accepted')}
                          activeOpacity={0.8}
                          style={{ backgroundColor: '#4CAF5033', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#4CAF5055' }}
                        >
                          <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: 'bold' }}>✓ Aceitar</Text>
                        </TouchableOpacity>
                      ) : isPendingSent ? (
                        <View style={{ backgroundColor: '#1A1A1A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#2A2A2A' }}>
                          <Text style={{ color: '#707070', fontSize: 12 }}>Enviado ✓</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleSendRequest(profile.id)}
                          activeOpacity={0.85}
                          disabled={isSending}
                          style={{ backgroundColor: '#D62828', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, minWidth: 80, alignItems: 'center' }}
                        >
                          {isSending ? (
                            <ActivityIndicator color="#fff" size="small" style={{ height: 18 }} />
                          ) : (
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Adicionar</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Container>
  );
}
