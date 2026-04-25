import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabaseClient, hasSupabaseEnv } from './supabase'

export type OnlineGameKey =
  | 'lobby'
  | 'number-duel'
  | 'mine-matrix'
  | 'truth-dare'
  | 'never-have-i-ever'
  | 'celebrity-guess'
  | 'hangman'
  | 'tic-tac-toe'
  | 'dots-boxes'
  | 'race-dash'

export type RoomStatus = 'waiting' | 'ready' | 'playing' | 'finished'

export type RoomState = {
  version: number
  activeGame: OnlineGameKey
  turn: 'host' | 'guest' | 'both'
  phase: string
  payload: Record<string, unknown>
  updatedAt: string
}

export type GameRoom = {
  id: string
  code: string
  host_name: string
  guest_name: string | null
  game_key: OnlineGameKey
  status: RoomStatus
  room_state: RoomState
  created_at: string
  updated_at: string
}

export type RoomBroadcastEvent =
  | 'state-sync'
  | 'game-action'
  | 'race-progress'
  | 'system-message'

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ROOM_CODE_LENGTH = 6

function createDefaultRoomState(gameKey: OnlineGameKey): RoomState {
  return {
    version: 1,
    activeGame: gameKey,
    turn: 'host',
    phase: 'lobby',
    payload: {},
    updatedAt: new Date().toISOString(),
  }
}

function generateRoomCode() {
  let code = ''

  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    const nextIndex = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)
    code += ROOM_CODE_ALPHABET[nextIndex]
  }

  return code
}

function requireSupabase() {
  const client = getSupabaseClient()

  if (!client) {
    throw new Error('Supabase env vars are missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }

  return client
}

export function isOnlinePlayConfigured() {
  return hasSupabaseEnv
}

export async function createOnlineRoom(hostName: string, gameKey: OnlineGameKey = 'lobby') {
  const client = requireSupabase()

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateRoomCode()
    const { data, error } = await client
      .from('game_rooms')
      .insert({
        code,
        host_name: hostName,
        game_key: gameKey,
        status: 'waiting',
        room_state: createDefaultRoomState(gameKey),
      })
      .select()
      .single()

    if (!error) {
      return data as GameRoom
    }
  }

  throw new Error('Unable to create a unique room right now. Please try again.')
}

export async function joinOnlineRoom(code: string, guestName: string) {
  const client = requireSupabase()
  const normalizedCode = code.trim().toUpperCase()

  const { data: room, error: roomError } = await client
    .from('game_rooms')
    .select('*')
    .eq('code', normalizedCode)
    .maybeSingle()

  if (roomError) {
    throw roomError
  }

  if (!room) {
    throw new Error('Room not found.')
  }

  const { data, error } = await client
    .from('game_rooms')
    .update({
      guest_name: guestName,
      status: 'ready',
    })
    .eq('id', room.id)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data as GameRoom
}

export async function getOnlineRoom(code: string) {
  const client = requireSupabase()
  const normalizedCode = code.trim().toUpperCase()
  const { data, error } = await client
    .from('game_rooms')
    .select('*')
    .eq('code', normalizedCode)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error('Room not found.')
  }

  return data as GameRoom
}

export async function saveOnlineRoomState(
  roomId: string,
  roomState: RoomState,
  updates: Partial<Pick<GameRoom, 'game_key' | 'status' | 'guest_name'>> = {},
) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('game_rooms')
    .update({
      room_state: {
        ...roomState,
        updatedAt: new Date().toISOString(),
      },
      ...updates,
    })
    .eq('id', roomId)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data as GameRoom
}

export async function broadcastRoomEvent(
  roomCode: string,
  event: RoomBroadcastEvent,
  payload: Record<string, unknown>,
) {
  const channel = requireSupabase().channel(`room:${roomCode}`)
  const result = await channel.send({
    type: 'broadcast',
    event,
    payload,
  })

  if (result !== 'ok') {
    throw new Error(`Unable to send room event: ${result}`)
  }
}

export function subscribeToOnlineRoom(
  roomCode: string,
  options: {
    onRoomEvent?: (event: RoomBroadcastEvent, payload: Record<string, unknown>) => void
    onPresenceSync?: (onlineCount: number) => void
  },
) {
  const client = requireSupabase()
  const channel = client.channel(`room:${roomCode}`, {
    config: {
      presence: {
        key: `player-${Math.random().toString(36).slice(2, 9)}`,
      },
    },
  })

  channel.on('broadcast', { event: '*' }, ({ event, payload }) => {
    options.onRoomEvent?.(event as RoomBroadcastEvent, (payload ?? {}) as Record<string, unknown>)
  })

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState()
    options.onPresenceSync?.(Object.keys(state).length)
  })

  void channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        joinedAt: new Date().toISOString(),
      })
    }
  })

  return channel
}

export function releaseOnlineRoomSubscription(channel: RealtimeChannel) {
  const client = getSupabaseClient()

  if (!client) {
    return
  }

  void client.removeChannel(channel)
}

export function getRaceSyncPlan(durationSeconds = 20) {
  return {
    durationSeconds,
    publishIntervalMs: 250,
    minimumProgressStep: 0.05,
    finishBurstEvents: 1,
  }
}
