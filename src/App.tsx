import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import './App.css'
import {
  broadcastRoomEvent,
  createOnlineRoom,
  getOnlineRoom,
  isOnlinePlayConfigured,
  joinOnlineRoom,
  releaseOnlineRoomSubscription,
  saveOnlineRoomState,
  subscribeToOnlineRoom,
} from './lib/online'
import type { GameRoom, RoomState, RoomStatus } from './lib/online'

type PlayerIndex = 0 | 1
type Screen =
  | 'setup'
  | 'home'
  | 'online-room'
  | 'number-duel'
  | 'word-chain'
  | 'mine-matrix'
  | 'truth-dare'
  | 'never-have-i-ever'
  | 'celebrity-guess'
  | 'hangman'
  | 'tic-tac-toe'
  | 'dots-boxes'
type HomeMode = 'same-screen' | 'online'
type CharacterMood = 'happy' | 'sad'
type CharacterEnergy = 'none' | 'winner' | 'loser'
type SessionWinner = PlayerIndex | 'both' | 'draw' | null
type TruthKind = 'Truth' | 'Dare'
type FeedbackTone =
  | 'soft'
  | 'higher'
  | 'lower'
  | 'win'
  | 'success'
  | 'warning'
  | 'truth'
  | 'dare'

type Reward = {
  id: string
  threshold: number
  title: string
  description: string
}

type ReactionCue = {
  speaker: PlayerIndex
  message: string
  support: string
  emoji?: string
  tone: FeedbackTone
}

type GuessTracker = {
  target: number
  min: number
  max: number
  attempts: number
  recentHints: string[]
}

type HistoryEntry = {
  id: string
  game: string
  winner: string
  points: number
  summary: string
}

type ProfileState = {
  players: [string, string]
  playerColors: [string, string]
  bondScore: number
  unlockedRewardIds: string[]
  matchesPlayed: number
  history: HistoryEntry[]
}

type NumberDuelState = {
  view: 'secret' | 'pass' | 'guess' | 'reveal' | 'result'
  currentPlayer: PlayerIndex
  secrets: [number | null, number | null]
  trackers: [GuessTracker | null, GuessTracker | null]
  winner: PlayerIndex | null
  passTitle: string
  passNote: string
  nextView: 'secret' | 'guess'
  statusMessage: string
  cue: ReactionCue | null
}

type OnlineRole = 'host' | 'guest'

type OnlineNumberDuelState = {
  phase: 'setup' | 'guess' | 'reveal' | 'result'
  ready: [boolean, boolean]
  secrets: [number | null, number | null]
  trackers: [GuessTracker | null, GuessTracker | null]
  currentTurn: PlayerIndex
  winner: PlayerIndex | null
  cue: ReactionCue | null
  statusMessage: string
}

type OnlineRaceDashState = {
  phase: 'countdown' | 'racing' | 'result'
  targetTaps: number
  durationMs: number
  startsAt: string
  endsAt: string
  taps: [number, number]
  progress: [number, number]
  winner: SessionWinner
  cue: ReactionCue | null
  statusMessage: string
}

type OnlineTicTacToeState = {
  phase: 'play' | 'result'
  board: Array<PlayerIndex | null>
  currentTurn: PlayerIndex
  winner: SessionWinner
  cue: ReactionCue | null
  statusMessage: string
}

type OnlineMineMatrixState = {
  phase: 'setup' | 'play' | 'reveal' | 'result'
  ready: [boolean, boolean]
  plantingSelections: [number[], number[]]
  mineBoards: [number[], number[]]
  revealedBoards: [number[], number[]]
  mineHits: [number, number]
  currentTurn: PlayerIndex
  winner: PlayerIndex | null
  pendingCell: number | null
  pendingTarget: PlayerIndex | null
  pendingHit: boolean | null
  nextTurn: PlayerIndex | null
  resolvingResult: boolean
  cue: ReactionCue | null
  statusMessage: string
}

type OnlineTruthOrDareState = {
  phase: 'choose' | 'card' | 'result'
  currentPlayer: PlayerIndex
  round: number
  totalRounds: number
  scores: [number, number]
  activeCard: TruthOrDareCard | null
  truthIndex: number
  dareIndex: number
  winner: SessionWinner
  resultSummary: string
  cue: ReactionCue | null
  statusMessage: string
}

type OnlineNeverHaveIState = {
  phase: 'intro' | 'answer' | 'reveal' | 'result'
  round: number
  totalRounds: number
  promptIndex: number
  currentPrompt: string
  answers: [boolean | null, boolean | null]
  sharedScore: number
  resultSummary: string
  cue: ReactionCue | null
  statusMessage: string
}

type OnlineCelebrityGuessState = {
  phase: 'secret' | 'questions' | 'result'
  chooser: PlayerIndex
  guesser: PlayerIndex
  secretCelebrity: string
  questionCount: number
  maxQuestions: number
  pendingQuestion: string | null
  history: { question: string; answer: CelebrityAnswer }[]
  winner: PlayerIndex | null
  resultSummary: string
  cue: ReactionCue | null
  statusMessage: string
}

type OnlineHangmanState = {
  phase: 'secret' | 'guess' | 'result'
  round: number
  totalRounds: number
  setter: PlayerIndex
  guesser: PlayerIndex
  scores: [number, number]
  word: string
  guessedLetters: string[]
  wrongLetters: string[]
  winner: SessionWinner
  resultSummary: string
  cue: ReactionCue | null
  statusMessage: string
}

type OnlineDotsBoxesState = {
  phase: 'play' | 'result'
  lines: Record<string, PlayerIndex>
  boxes: Array<PlayerIndex | null>
  scores: [number, number]
  currentTurn: PlayerIndex
  winner: SessionWinner
  resultSummary: string
  cue: ReactionCue | null
  statusMessage: string
}

type OnlineWordChainState = {
  phase: 'play' | 'result'
  currentPlayer: PlayerIndex
  requiredLetter: string
  history: WordChainEntry[]
  usedWords: string[]
  winner: PlayerIndex | null
  resultSummary: string
  cue: ReactionCue | null
  statusMessage: string
}

type OnlineEmojiMessage = {
  id: string
  player: PlayerIndex
  emoji: string
  createdAt: string
}

type OnlineRoomPayload = {
  players: [string, string]
  colors: [string, string]
  numberDuel: OnlineNumberDuelState | null
  wordChain: OnlineWordChainState | null
  raceDash: OnlineRaceDashState | null
  ticTacToe: OnlineTicTacToeState | null
  mineMatrix: OnlineMineMatrixState | null
  truthOrDare: OnlineTruthOrDareState | null
  neverHaveI: OnlineNeverHaveIState | null
  celebrityGuess: OnlineCelebrityGuessState | null
  hangman: OnlineHangmanState | null
  dotsBoxes: OnlineDotsBoxesState | null
  chat: OnlineEmojiMessage[]
  lastEvent: string
}

type OnlineSessionState = {
  roomId: string
  roomCode: string
  role: OnlineRole
  players: [string, string]
  colors: [string, string]
  roomStatus: RoomStatus
  roomState: RoomState
  onlineCount: number
  connectionStatus: 'connecting' | 'live' | 'error'
  errorMessage: string
}

type MineMatrixState = {
  view: 'plant' | 'pass' | 'play' | 'result'
  currentPlayer: PlayerIndex
  plantingSelections: [number[], number[]]
  mineBoards: [number[], number[]]
  revealedBoards: [number[], number[]]
  mineHits: [number, number]
  winner: PlayerIndex | null
  passTitle: string
  passNote: string
  nextView: 'plant' | 'play'
  statusMessage: string
  cue: ReactionCue
}

type TruthOrDareCard = {
  kind: TruthKind
  prompt: string
}

type TruthOrDareState = {
  view: 'choose' | 'card' | 'pass' | 'result'
  currentPlayer: PlayerIndex
  round: number
  totalRounds: number
  scores: [number, number]
  activeCard: TruthOrDareCard | null
  truthIndex: number
  dareIndex: number
  passTitle: string
  passNote: string
  nextView: 'choose' | 'result'
  winner: SessionWinner
  resultSummary: string
  cue: ReactionCue
}

type NeverHaveIState = {
  view: 'intro' | 'answer' | 'pass' | 'reveal' | 'result'
  round: number
  totalRounds: number
  promptIndex: number
  currentPrompt: string
  currentPlayer: PlayerIndex
  answers: [boolean | null, boolean | null]
  sharedScore: number
  passTitle: string
  passNote: string
  resultSummary: string
  cue: ReactionCue
}

type CelebrityAnswer = 'Yes' | 'No' | 'Maybe'

type CelebrityGuessState = {
  view: 'secret' | 'pass' | 'questions' | 'result'
  chooser: PlayerIndex
  guesser: PlayerIndex
  secretCelebrity: string
  questionCount: number
  maxQuestions: number
  pendingQuestion: string | null
  history: { question: string; answer: CelebrityAnswer }[]
  passTitle: string
  passNote: string
  winner: PlayerIndex | null
  resultSummary: string
  cue: ReactionCue
}

type HangmanState = {
  view: 'secret' | 'pass' | 'guess' | 'result'
  setter: PlayerIndex
  guesser: PlayerIndex
  word: string
  guessedLetters: string[]
  wrongLetters: string[]
  passTitle: string
  passNote: string
  winner: PlayerIndex | null
  resultSummary: string
  cue: ReactionCue
}

type TicTacToeState = {
  view: 'play' | 'result'
  board: Array<PlayerIndex | null>
  currentPlayer: PlayerIndex
  winner: SessionWinner
  resultSummary: string
  cue: ReactionCue
}

type DotsBoxesState = {
  view: 'play' | 'result'
  lines: Record<string, PlayerIndex>
  boxes: Array<PlayerIndex | null>
  scores: [number, number]
  currentPlayer: PlayerIndex
  winner: SessionWinner
  resultSummary: string
  cue: ReactionCue
}

type WordChainEntry = {
  player: PlayerIndex
  word: string
}

type WordChainState = {
  view: 'play' | 'result'
  currentPlayer: PlayerIndex
  requiredLetter: string
  history: WordChainEntry[]
  usedWords: string[]
  winner: PlayerIndex | null
  resultSummary: string
  cue: ReactionCue | null
  statusMessage: string
  validating: boolean
  error: string
}

const STORAGE_KEY = 'couples-club-profile'
const DOTS_SIZE = 4
const GRID_CELLS = Array.from({ length: 9 }, (_, index) => index)
const PLAYER_COLOR_OPTIONS = [
  '#6dd7c5',
  '#f16f47',
  '#7a8cff',
  '#ff8db4',
  '#8ccf63',
  '#f2b75e',
] as const
const THUMBS_UP = '\u{1F44D}'
const KISS_HEART = '\u{1F618}\u{1F496}'
const MINE_ICON = '\u{1F4A3}'
const SAFE_ICON = '\u{1F353}'

const REWARDS: Reward[] = [
  {
    id: 'slow-burn',
    threshold: 50,
    title: 'Slow Burn Date',
    description: 'Plan a full evening date with no phones for at least one hour.',
  },
  {
    id: 'winner-week',
    threshold: 120,
    title: 'Winner Week',
    description: 'The current bond leader gets to choose one plan this week and cash it in.',
  },
  {
    id: 'deep-night',
    threshold: 220,
    title: 'Deep Night Unlock',
    description: 'Set aside a full night for dinner, cards, and three honest conversations.',
  },
  {
    id: 'micro-trip',
    threshold: 360,
    title: 'Mini Adventure',
    description: 'Book or plan a half-day trip together somewhere outside your usual routine.',
  },
]

const PLAYABLE_GAMES = [
  {
    title: 'Number Duel',
    description: 'Hide a number, narrow the range, and guess it first.',
    accent: '#f16f47',
    key: 'number-duel',
  },
  {
    title: 'Mine Matrix',
    description: 'Plant three mines and avoid reaching three strikes.',
    accent: '#6dd7c5',
    key: 'mine-matrix',
  },
  {
    title: 'Word Chain',
    description: 'Build a chain by using the last letter of the previous word.',
    accent: '#59b7a5',
    key: 'word-chain',
  },
  {
    title: 'Truth or Dare',
    description: 'Alternate prompts and earn session points.',
    accent: '#7a8cff',
    key: 'truth-dare',
  },
  {
    title: 'Never Have I Ever',
    description: 'Reveal matching answers and build shared score.',
    accent: '#ff8db4',
    key: 'never-have-i-ever',
  },
  {
    title: 'Celebrity Guess',
    description: 'Choose a celebrity, answer questions, and see if they can guess.',
    accent: '#f2b75e',
    key: 'celebrity-guess',
  },
  {
    title: 'Hangman',
    description: 'One partner hides the word while the other hunts letters.',
    accent: '#8ccf63',
    key: 'hangman',
  },
  {
    title: 'Tic Tac Toe',
    description: 'Simple, classic, and still perfect for a quick rivalry.',
    accent: '#d95b4f',
    key: 'tic-tac-toe',
  },
  {
    title: 'Dots and Boxes',
    description: 'Draw lines, close boxes, and keep the turn when you score.',
    accent: '#5165e0',
    key: 'dots-boxes',
  },
] as const

const TRUTH_PROMPTS = [
  'What is one thing your partner does that makes you feel instantly safe?',
  'What was your very first impression of your partner?',
  'What little habit of theirs secretly makes you smile?',
  'What is one date idea you still want to do together this year?',
  'What is a tiny thing your partner could do more often that would make you feel loved?',
  'What moment in your relationship felt like a movie scene?',
  'What quality in your partner do you admire the most right now?',
  'What memory from this month would you keep forever if you could?',
]

const DARE_PROMPTS = [
  'Give your partner a dramatic 20-second compliment speech.',
  'Do your best impression of how your partner acts when they are hungry.',
  'Hold hands for the next full round and do not let go.',
  'Let your partner choose a nickname you must use until this session ends.',
  'Act out your dream vacation together without speaking.',
  'Send your partner a sweet text they can keep for later.',
  'Do a 10-second victory dance just for your partner.',
  'Say one thing you want to thank your partner for today.',
]

const NEVER_HAVE_I_PROMPTS = [
  'Never have I ever stalked my partner on social media before we were officially together.',
  'Never have I ever secretly saved a screenshot of my partner looking cute.',
  'Never have I ever rehearsed a text before sending it to my partner.',
  'Never have I ever pretended not to be jealous when I actually was.',
  'Never have I ever planned a surprise for my partner and almost spoiled it.',
  'Never have I ever replayed one of our best dates in my head before sleeping.',
]

const CELEBRITY_OPTIONS = [
  'Taylor Swift',
  'Zendaya',
  'Tom Holland',
  'Beyonce',
  'Shah Rukh Khan',
  'Emma Stone',
  'Chris Evans',
  'Rihanna',
  'Timothee Chalamet',
  'Jenna Ortega',
  'Ryan Reynolds',
  'Selena Gomez',
]

const CELEBRITY_QUESTIONS = [
  'Are they mainly known for music?',
  'Are they mainly known for acting?',
  'Are they under 40 years old?',
  'Are they American?',
  'Have they won a major award?',
  'Are they known for superhero movies?',
  'Do they have dark hair?',
  'Are they a woman?',
]

const ONLINE_CHAT_EMOJIS = ['❤️', '😘', '😂', '🔥', '👏', '😈', '😭', '🤝'] as const

const WORD_CHAIN_COMMON_WORDS = new Set([
  'apple','anchor','angel','arrow','artist','avocado','banana','basket','beach','beacon','bear','berry','bottle','button',
  'candle','candy','carrot','castle','cat','caterpillar','cheese','circle','coconut','coffee','comet','crystal',
  'dance','desert','dinner','dragon','dream','drum','eagle','earth','echo','emerald','engine','evening',
  'falcon','family','feather','festival','flame','flower','forest','friend','galaxy','garden','ginger','glitter','grape','guitar',
  'harbor','harmony','hazel','heart','helmet','honey','horizon','hotel','iceberg','island','ivory',
  'jacket','jasmine','jelly','jungle','karma','kettle','kingdom','kitten','kiwi',
  'ladder','lantern','lemon','letter','library','lilac','lion','lizard','lobby','lotus',
  'magic','maple','marble','market','melody','meteor','mirror','monkey','mountain','music',
  'napkin','needle','nectar','night','notebook','oasis','ocean','olive','opera','orange','orchid','otter',
  'panda','paper','parade','peanut','pearl','pepper','phoenix','piano','planet','pocket','poetry','pumpkin',
  'quartz','queen','quill',
  'rabbit','raccoon','rainbow','river','rocket','rose','saffron','sailor','sandwich','sapphire','school','shadow','shell','silver','skyline','song','spark','spirit','star','sunset',
  'tangerine','teacup','temple','thunder','ticket','tiger','tomato','topaz','tower','travel','tulip',
  'umbrella','unicorn','valley','velvet','violin','voyage',
  'walnut','waterfall','whisper','window','winter','wizard','xylophone',
  'yacht','yellow','yogurt','yonder','zebra','zephyr','zinnia',
]) 

const WORD_CHAIN_STARTERS = ['A', 'B', 'C', 'D', 'F', 'G', 'L', 'M', 'P', 'R', 'S', 'T'] as const

const HANGMAN_MISS_LINES = [
  {
    message: 'Okay, tiny problem',
    support: 'Maybe warm up with an easy letter before this gets dramatic.',
  },
  {
    message: 'That was not it',
    support: 'I am officially requesting more vowels and less chaos.',
  },
  {
    message: 'You are stressing me out',
    support: 'If this is my last word, I hoped it would be cooler than this.',
  },
  {
    message: 'Please lock in',
    support: 'My feet are doing less touching-the-ground than I would like.',
  },
  {
    message: 'This is getting very real',
    support: 'Tell everyone I was charming and only slightly dramatic.',
  },
  {
    message: 'Last chance hero',
    support: 'One more miss and my final review of this date night will be complicated.',
  },
] as const

const createCue = (
  speaker: PlayerIndex,
  message: string,
  support: string,
  emoji = THUMBS_UP,
  tone: FeedbackTone = 'soft',
): ReactionCue => ({
  speaker,
  message,
  support,
  emoji,
  tone,
})

const createEmptyProfile = (): ProfileState => ({
  players: ['', ''],
  playerColors: [PLAYER_COLOR_OPTIONS[0], PLAYER_COLOR_OPTIONS[1]],
  bondScore: 0,
  unlockedRewardIds: [],
  matchesPlayed: 0,
  history: [],
})

const getUnlockedRewardIds = (bondScore: number) =>
  REWARDS.filter((reward) => bondScore >= reward.threshold).map(
    (reward) => reward.id,
  )

const createTracker = (target: number): GuessTracker => ({
  target,
  min: 1,
  max: 999,
  attempts: 0,
  recentHints: [],
})

const createNumberDuel = (): NumberDuelState => ({
  view: 'secret',
  currentPlayer: 0,
  secrets: [null, null],
  trackers: [null, null],
  winner: null,
  passTitle: '',
  passNote: '',
  nextView: 'secret',
  statusMessage: '',
  cue: null,
})

const createOnlineNumberDuel = (): OnlineNumberDuelState => ({
  phase: 'setup',
  ready: [false, false],
  secrets: [null, null],
  trackers: [null, null],
  currentTurn: 0,
  winner: null,
  cue: createCue(0, 'Lock your secret', 'Both players pick a number from 1 to 999.', KISS_HEART, 'soft'),
  statusMessage: 'Waiting for both players to lock a secret number.',
})

const createOnlineRaceDash = (): OnlineRaceDashState => {
  const startsAt = new Date(Date.now() + 3200)
  const endsAt = new Date(startsAt.getTime() + 20000)

  return {
    phase: 'countdown',
    targetTaps: 120,
    durationMs: 20000,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    taps: [0, 0],
    progress: [0, 0],
    winner: null,
    cue: createCue(0, 'Ready, set...', 'Mash space or tap the button when the countdown ends.', THUMBS_UP, 'soft'),
    statusMessage: 'The race starts in a few seconds.',
  }
}

const createOnlineTicTacToe = (): OnlineTicTacToeState => ({
  phase: 'play',
  board: Array<PlayerIndex | null>(9).fill(null),
  currentTurn: 0,
  winner: null,
  cue: createCue(1, 'Board is live', 'Host opens with the first move.', THUMBS_UP, 'soft'),
  statusMessage: 'Host moves first.',
})

const createOnlineMineMatrix = (): OnlineMineMatrixState => ({
  phase: 'setup',
  ready: [false, false],
  plantingSelections: [[], []],
  mineBoards: [[], []],
  revealedBoards: [[], []],
  mineHits: [0, 0],
  currentTurn: 0,
  winner: null,
  pendingCell: null,
  pendingTarget: null,
  pendingHit: null,
  nextTurn: null,
  resolvingResult: false,
  cue: createCue(1, 'Plant your mines', 'Each player hides three spots on their own device.', KISS_HEART, 'soft'),
  statusMessage: 'Waiting for both mine layouts.',
})

const createOnlineTruthOrDare = (): OnlineTruthOrDareState => ({
  phase: 'choose',
  currentPlayer: 0,
  round: 1,
  totalRounds: 6,
  scores: [0, 0],
  activeCard: null,
  truthIndex: 0,
  dareIndex: 0,
  winner: null,
  resultSummary: '',
  cue: createCue(1, 'Pick your card', 'Truth or Dare starts with the host.', KISS_HEART, 'soft'),
  statusMessage: 'Host chooses Truth or Dare.',
})

const createOnlineNeverHaveI = (): OnlineNeverHaveIState => ({
  phase: 'intro',
  round: 1,
  totalRounds: 6,
  promptIndex: 0,
  currentPrompt: NEVER_HAVE_I_PROMPTS[0],
  answers: [null, null],
  sharedScore: 0,
  resultSummary: '',
  cue: createCue(1, 'Be honest', 'Both of you answer on your own screens.', THUMBS_UP, 'soft'),
  statusMessage: 'Read the prompt and get ready to answer.',
})

const createOnlineCelebrityGuess = (): OnlineCelebrityGuessState => ({
  phase: 'secret',
  chooser: 0,
  guesser: 1,
  secretCelebrity: '',
  questionCount: 0,
  maxQuestions: 6,
  pendingQuestion: null,
  history: [],
  winner: null,
  resultSummary: '',
  cue: createCue(0, 'Pick the celebrity', 'The guest will start asking questions after you lock one.', KISS_HEART, 'soft'),
  statusMessage: 'Host picks the celebrity first.',
})

const createOnlineHangman = (): OnlineHangmanState => ({
  phase: 'secret',
  round: 1,
  totalRounds: 2,
  setter: 0,
  guesser: 1,
  scores: [0, 0],
  word: '',
  guessedLetters: [],
  wrongLetters: [],
  winner: null,
  resultSummary: '',
  cue: createCue(0, 'Choose the word', 'The guest will try to rescue you.', THUMBS_UP, 'soft'),
  statusMessage: 'Host sets the hidden word first.',
})

const createOnlineDotsBoxes = (): OnlineDotsBoxesState => ({
  phase: 'play',
  lines: {},
  boxes: Array<PlayerIndex | null>(DOTS_SIZE * DOTS_SIZE).fill(null),
  scores: [0, 0],
  currentTurn: 0,
  winner: null,
  resultSummary: '',
  cue: createCue(1, 'Board is live', 'Host draws the opening line.', THUMBS_UP, 'soft'),
  statusMessage: 'Host starts the board.',
})

const createOnlineWordChain = (): OnlineWordChainState => {
  const requiredLetter = WORD_CHAIN_STARTERS[Math.floor(Math.random() * WORD_CHAIN_STARTERS.length)]
  return {
    phase: 'play',
    currentPlayer: 0,
    requiredLetter,
    history: [],
    usedWords: [],
    winner: null,
    resultSummary: '',
    cue: createCue(1, 'Word chain starts', `Use a word that begins with ${requiredLetter}.`, THUMBS_UP, 'soft'),
    statusMessage: `${requiredLetter} is the starter letter. Host opens the chain.`,
  }
}

const createOnlinePayload = (hostName: string, hostColor: string): OnlineRoomPayload => ({
  players: [hostName, ''],
  colors: [hostColor, PLAYER_COLOR_OPTIONS[1]],
  numberDuel: null,
  wordChain: null,
  raceDash: null,
  ticTacToe: null,
  mineMatrix: null,
  truthOrDare: null,
  neverHaveI: null,
  celebrityGuess: null,
  hangman: null,
  dotsBoxes: null,
  chat: [],
  lastEvent: 'Room created',
})

const readOnlinePayload = (payload: RoomState['payload']): OnlineRoomPayload => {
  const value = payload as Partial<OnlineRoomPayload>
  const players: [string, string] = Array.isArray(value.players)
    ? [(value.players[0] as string) ?? '', (value.players[1] as string) ?? '']
    : ['', '']
  const colors: [string, string] = Array.isArray(value.colors)
    ? [
        (value.colors[0] as string) ?? PLAYER_COLOR_OPTIONS[0],
        (value.colors[1] as string) ?? PLAYER_COLOR_OPTIONS[1],
      ]
    : [PLAYER_COLOR_OPTIONS[0], PLAYER_COLOR_OPTIONS[1]]

  return {
    players,
    colors,
    numberDuel:
      value.numberDuel && typeof value.numberDuel === 'object'
        ? (value.numberDuel as OnlineNumberDuelState)
        : null,
    wordChain:
      value.wordChain && typeof value.wordChain === 'object'
        ? (value.wordChain as OnlineWordChainState)
        : null,
    raceDash:
      value.raceDash && typeof value.raceDash === 'object'
        ? (value.raceDash as OnlineRaceDashState)
        : null,
    ticTacToe:
      value.ticTacToe && typeof value.ticTacToe === 'object'
        ? (value.ticTacToe as OnlineTicTacToeState)
        : null,
    mineMatrix:
      value.mineMatrix && typeof value.mineMatrix === 'object'
        ? (value.mineMatrix as OnlineMineMatrixState)
        : null,
    truthOrDare:
      value.truthOrDare && typeof value.truthOrDare === 'object'
        ? (value.truthOrDare as OnlineTruthOrDareState)
        : null,
    neverHaveI:
      value.neverHaveI && typeof value.neverHaveI === 'object'
        ? (value.neverHaveI as OnlineNeverHaveIState)
        : null,
    celebrityGuess:
      value.celebrityGuess && typeof value.celebrityGuess === 'object'
        ? (value.celebrityGuess as OnlineCelebrityGuessState)
        : null,
    hangman:
      value.hangman && typeof value.hangman === 'object'
        ? (value.hangman as OnlineHangmanState)
        : null,
    dotsBoxes:
      value.dotsBoxes && typeof value.dotsBoxes === 'object'
        ? (value.dotsBoxes as OnlineDotsBoxesState)
        : null,
    chat: Array.isArray(value.chat)
      ? value.chat
          .filter((item): item is OnlineEmojiMessage => {
            if (!item || typeof item !== 'object') {
              return false
            }

            const entry = item as Partial<OnlineEmojiMessage>
            return (
              (entry.player === 0 || entry.player === 1) &&
              typeof entry.id === 'string' &&
              typeof entry.emoji === 'string' &&
              typeof entry.createdAt === 'string'
            )
          })
          .slice(-18)
      : [],
    lastEvent: typeof value.lastEvent === 'string' ? value.lastEvent : '',
  }
}

const clearOnlineGames = (payload: OnlineRoomPayload): OnlineRoomPayload => ({
  ...payload,
  numberDuel: null,
  wordChain: null,
  raceDash: null,
  ticTacToe: null,
  mineMatrix: null,
  truthOrDare: null,
  neverHaveI: null,
  celebrityGuess: null,
  hangman: null,
  dotsBoxes: null,
})

const mergeRaceDashPayload = (
  incomingPayload: OnlineRoomPayload,
  currentPayload: OnlineRoomPayload,
): OnlineRoomPayload => {
  if (!incomingPayload.raceDash || !currentPayload.raceDash) {
    return incomingPayload
  }

  if (
    incomingPayload.raceDash.startsAt !== currentPayload.raceDash.startsAt ||
    incomingPayload.raceDash.endsAt !== currentPayload.raceDash.endsAt
  ) {
    return incomingPayload
  }

  return {
    ...incomingPayload,
    raceDash: {
      ...incomingPayload.raceDash,
      phase:
        incomingPayload.raceDash.phase === 'result' || currentPayload.raceDash.phase !== 'result'
          ? incomingPayload.raceDash.phase
          : currentPayload.raceDash.phase,
      taps: [
        Math.max(incomingPayload.raceDash.taps[0], currentPayload.raceDash.taps[0]),
        Math.max(incomingPayload.raceDash.taps[1], currentPayload.raceDash.taps[1]),
      ],
      progress: [
        Math.max(incomingPayload.raceDash.progress[0], currentPayload.raceDash.progress[0]),
        Math.max(incomingPayload.raceDash.progress[1], currentPayload.raceDash.progress[1]),
      ],
      winner:
        incomingPayload.raceDash.winner ??
        (currentPayload.raceDash.phase === 'result' ? currentPayload.raceDash.winner : null),
      cue:
        incomingPayload.raceDash.phase === 'result'
          ? incomingPayload.raceDash.cue
          : currentPayload.raceDash.phase === 'result'
            ? currentPayload.raceDash.cue
            : incomingPayload.raceDash.cue,
      statusMessage:
        incomingPayload.raceDash.phase === 'result'
          ? incomingPayload.raceDash.statusMessage
          : currentPayload.raceDash.phase === 'result'
            ? currentPayload.raceDash.statusMessage
            : incomingPayload.raceDash.statusMessage || currentPayload.raceDash.statusMessage,
    },
  }
}

const mergeIncomingRoomWithCurrentState = (room: GameRoom, currentRoomState: RoomState | null): GameRoom => {
  if (!currentRoomState) {
    return room
  }

  if (room.room_state.activeGame !== 'race-dash' || currentRoomState.activeGame !== 'race-dash') {
    return room
  }

  const incomingPayload = readOnlinePayload(room.room_state.payload)
  const currentPayload = readOnlinePayload(currentRoomState.payload)
  const mergedPayload = mergeRaceDashPayload(incomingPayload, currentPayload)

  return {
    ...room,
    room_state: {
      ...room.room_state,
      payload: mergedPayload as unknown as Record<string, unknown>,
    },
  }
}

const buildOnlineRoomState = (
  payload: OnlineRoomPayload,
  activeGame: RoomState['activeGame'] = 'lobby',
  phase = 'waiting',
  turn: RoomState['turn'] = 'both',
): RoomState => ({
  version: 1,
  activeGame,
  turn,
  phase,
  payload: payload as unknown as Record<string, unknown>,
  updatedAt: new Date().toISOString(),
})

const roleToPlayerIndex = (role: OnlineRole): PlayerIndex => (role === 'host' ? 0 : 1)
const turnForPlayer = (player: PlayerIndex): RoomState['turn'] => (player === 0 ? 'host' : 'guest')
const canStartOnlineGame = (
  session: OnlineSessionState | null,
  gameKey: RoomState['activeGame'],
  requireHost = true,
) => {
  if (!session) {
    return false
  }

  if (!requireHost || session.role === 'host') {
    return true
  }

  return session.roomState.activeGame === gameKey && session.roomState.phase === 'result'
}

const hydrateOnlineSessionFromRoom = (
  room: GameRoom,
  role: OnlineRole,
  currentOnlineCount = 1,
): OnlineSessionState => {
  const payload = readOnlinePayload(room.room_state.payload)
  const players: [string, string] = [
    payload.players[0] || room.host_name || 'Host',
    payload.players[1] || room.guest_name || '',
  ]

  return {
    roomId: room.id,
    roomCode: room.code,
    role,
    players,
    colors: payload.colors,
    roomStatus: room.status,
    roomState: room.room_state,
    onlineCount: currentOnlineCount,
    connectionStatus: 'connecting',
    errorMessage: '',
  }
}

const createMineMatrix = (): MineMatrixState => ({
  view: 'plant',
  currentPlayer: 0,
  plantingSelections: [[], []],
  mineBoards: [[], []],
  revealedBoards: [[], []],
  mineHits: [0, 0],
  winner: null,
  passTitle: '',
  passNote: '',
  nextView: 'plant',
  statusMessage: '',
  cue: createCue(1, 'Hide your mines', 'Choose three clever spots.', KISS_HEART, 'soft'),
})

const createTruthOrDare = (): TruthOrDareState => ({
  view: 'choose',
  currentPlayer: 0,
  round: 1,
  totalRounds: 6,
  scores: [0, 0],
  activeCard: null,
  truthIndex: 0,
  dareIndex: 0,
  passTitle: '',
  passNote: '',
  nextView: 'choose',
  winner: null,
  resultSummary: '',
  cue: createCue(1, 'You got this', 'Pick the vibe for this round.', KISS_HEART, 'soft'),
})

const createNeverHaveI = (): NeverHaveIState => ({
  view: 'intro',
  round: 1,
  totalRounds: 6,
  promptIndex: 0,
  currentPrompt: NEVER_HAVE_I_PROMPTS[0],
  currentPlayer: 0,
  answers: [null, null],
  sharedScore: 0,
  passTitle: '',
  passNote: '',
  resultSummary: '',
  cue: createCue(1, 'Be honest', 'Different answers are still fun.', THUMBS_UP, 'soft'),
})

const createCelebrityGuess = (): CelebrityGuessState => ({
  view: 'secret',
  chooser: 0,
  guesser: 1,
  secretCelebrity: '',
  questionCount: 0,
  maxQuestions: 6,
  pendingQuestion: null,
  history: [],
  passTitle: '',
  passNote: '',
  winner: null,
  resultSummary: '',
  cue: createCue(0, 'Pick someone iconic', 'Keep it secret from your partner.', KISS_HEART, 'soft'),
})

const createHangman = (): HangmanState => ({
  view: 'secret',
  setter: 0,
  guesser: 1,
  word: '',
  guessedLetters: [],
  wrongLetters: [],
  passTitle: '',
  passNote: '',
  winner: null,
  resultSummary: '',
  cue: createCue(0, 'Choose my last word', 'Make it guessable if you want me to survive this.', THUMBS_UP, 'soft'),
})

const createTicTacToe = (): TicTacToeState => ({
  view: 'play',
  board: Array<PlayerIndex | null>(9).fill(null),
  currentPlayer: 0,
  winner: null,
  resultSummary: '',
  cue: createCue(1, 'Your move', 'The center is always tempting.', THUMBS_UP, 'soft'),
})

const createDotsBoxes = (): DotsBoxesState => ({
  view: 'play',
  lines: {},
  boxes: Array<PlayerIndex | null>(DOTS_SIZE * DOTS_SIZE).fill(null),
  scores: [0, 0],
  currentPlayer: 0,
  winner: null,
  resultSummary: '',
  cue: createCue(1, 'Draw a line', 'Close a box and you keep the turn.', THUMBS_UP, 'soft'),
})

const createWordChain = (): WordChainState => {
  const requiredLetter = WORD_CHAIN_STARTERS[Math.floor(Math.random() * WORD_CHAIN_STARTERS.length)]
  return {
    view: 'play',
    currentPlayer: 0,
    requiredLetter,
    history: [],
    usedWords: [],
    winner: null,
    resultSummary: '',
    cue: createCue(1, 'Word chain starts', `Use a word that begins with ${requiredLetter}.`, THUMBS_UP, 'soft'),
    statusMessage: `${requiredLetter} is the starter letter.`,
    validating: false,
    error: '',
  }
}

const getCharacterStyle = (color: string): CSSProperties =>
  ({
    '--character-color': color,
  }) as CSSProperties

const normalizeText = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

const includesCell = (cells: number[], cell: number) => cells.includes(cell)
const normalizeWord = (value: string) => value.trim().toLowerCase().replace(/[^a-z]/g, '')
const getTerminalLetter = (word: string) => {
  const letters = normalizeWord(word)
  return letters ? letters.at(-1)?.toUpperCase() ?? '' : ''
}

async function validateDictionaryWord(word: string) {
  const normalized = normalizeWord(word)
  if (!normalized || normalized.length < 2) {
    return false
  }

  if (WORD_CHAIN_COMMON_WORDS.has(normalized)) {
    return true
  }

  try {
    const response = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(normalized)}&max=1`)
    if (!response.ok) {
      return false
    }

    const result = (await response.json()) as Array<{ word?: string }>
    return normalizeWord(result[0]?.word ?? '') === normalized
  } catch {
    return false
  }
}

const getTicWinner = (board: Array<PlayerIndex | null>) => {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ]

  for (const [a, b, c] of lines) {
    if (board[a] !== null && board[a] === board[b] && board[a] === board[c]) {
      return board[a]
    }
  }

  return null
}

const edgeKeyHorizontal = (row: number, col: number) => `h-${row}-${col}`
const edgeKeyVertical = (row: number, col: number) => `v-${row}-${col}`

const getBoxEdges = (boxIndex: number) => {
  const row = Math.floor(boxIndex / DOTS_SIZE)
  const col = boxIndex % DOTS_SIZE

  return [
    edgeKeyHorizontal(row, col),
    edgeKeyHorizontal(row + 1, col),
    edgeKeyVertical(row, col),
    edgeKeyVertical(row, col + 1),
  ]
}

const getAffectedBoxesForLine = (key: string) => {
  const [axis, rawRow, rawCol] = key.split('-')
  const row = Number(rawRow)
  const col = Number(rawCol)
  const boxes: number[] = []

  if (axis === 'h') {
    if (row > 0) {
      boxes.push((row - 1) * DOTS_SIZE + col)
    }
    if (row < DOTS_SIZE) {
      boxes.push(row * DOTS_SIZE + col)
    }
  } else {
    if (col > 0) {
      boxes.push(row * DOTS_SIZE + (col - 1))
    }
    if (col < DOTS_SIZE) {
      boxes.push(row * DOTS_SIZE + col)
    }
  }

  return boxes
}

const isBoxComplete = (
  lines: Record<string, PlayerIndex>,
  boxIndex: number,
) => getBoxEdges(boxIndex).every((edge) => edge in lines)

const maskHangmanWord = (word: string, guessedLetters: string[]) =>
  word
    .split('')
    .map((letter) => {
      if (letter === ' ') {
        return ' '
      }

      return guessedLetters.includes(letter) ? letter : '_'
    })
    .join(' ')

function Character({
  side,
  color,
  mood,
  energy = 'none',
  reactionEmoji,
}: {
  side: 'left' | 'right'
  color: string
  mood: CharacterMood
  energy?: CharacterEnergy
  reactionEmoji?: string
}) {
  return (
    <div
      className={`character ${side} ${mood === 'sad' ? 'mood-sad' : 'mood-happy'} ${
        energy !== 'none' ? `energy-${energy}` : ''
      }`}
      style={getCharacterStyle(color)}
    >
      <div className="character-head">
        <span className="eye left-eye"></span>
        <span className="eye right-eye"></span>
        <span className="mouth"></span>
      </div>
      <div className="character-body"></div>
      {reactionEmoji ? <span className="character-hand-emoji">{reactionEmoji}</span> : null}
    </div>
  )
}

function FeedbackScene({
  cue,
  speakerName,
  speakerColor,
}: {
  cue: ReactionCue
  speakerName: string
  speakerColor: string
}) {
  return (
    <div className="feedback-scene">
      <Character
        side="left"
        color={speakerColor}
        mood="happy"
        reactionEmoji={cue.emoji}
      />
      <div className="feedback-bubble">
        <p className="feedback-speaker">{speakerName} says</p>
        <h3 className={`feedback-text tone-${cue.tone}`}>{cue.message}</h3>
        <p className="feedback-support">{cue.support}</p>
      </div>
    </div>
  )
}

function ResultStage({
  winner,
  colors,
}: {
  winner: SessionWinner
  colors: [string, string]
}) {
  const leftMood: CharacterMood =
    winner === 1 ? 'sad' : 'happy'
  const rightMood: CharacterMood =
    winner === 0 ? 'sad' : 'happy'
  const bothCelebrate = winner === 'both' || winner === 'draw'

  return (
    <div className="result-stage" aria-hidden="true">
      <Character
        side="left"
        color={colors[0]}
        mood={bothCelebrate ? 'happy' : leftMood}
        energy={bothCelebrate ? 'winner' : winner === 0 ? 'winner' : winner === 1 ? 'loser' : 'none'}
      />
      <Character
        side="right"
        color={colors[1]}
        mood={bothCelebrate ? 'happy' : rightMood}
        energy={bothCelebrate ? 'winner' : winner === 1 ? 'winner' : winner === 0 ? 'loser' : 'none'}
      />
    </div>
  )
}

function GameTile({
  title,
  description,
  accent,
  action,
}: {
  title: string
  description: string
  accent: string
  action: () => void
}) {
  return (
    <article className="game-tile" style={{ '--tile-accent': accent } as CSSProperties}>
      <div>
        <p className="game-tile-tag">Playable now</p>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <button type="button" className="primary-button" onClick={action}>
        Play
      </button>
    </article>
  )
}

function App() {
  const [profile, setProfile] = useState<ProfileState>(() => {
    if (typeof window === 'undefined') {
      return createEmptyProfile()
    }

    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      return createEmptyProfile()
    }

    try {
      const parsed = JSON.parse(saved) as Partial<ProfileState>

      return {
        players: [parsed.players?.[0] ?? '', parsed.players?.[1] ?? ''],
        playerColors: [
          parsed.playerColors?.[0] ?? PLAYER_COLOR_OPTIONS[0],
          parsed.playerColors?.[1] ?? PLAYER_COLOR_OPTIONS[1],
        ],
        bondScore: parsed.bondScore ?? 0,
        unlockedRewardIds: parsed.unlockedRewardIds ?? [],
        matchesPlayed: parsed.matchesPlayed ?? 0,
        history: parsed.history ?? [],
      }
    } catch {
      return createEmptyProfile()
    }
  })
  const [screen, setScreen] = useState<Screen>(
    profile.players[0] && profile.players[1] ? 'home' : 'setup',
  )
  const [setupNames, setSetupNames] = useState<[string, string]>([
    profile.players[0],
    profile.players[1],
  ])
  const [setupColors, setSetupColors] = useState<[string, string]>([
    profile.playerColors[0],
    profile.playerColors[1],
  ])
  const [numberDuel, setNumberDuel] = useState<NumberDuelState | null>(null)
  const [mineMatrix, setMineMatrix] = useState<MineMatrixState | null>(null)
  const [truthOrDare, setTruthOrDare] = useState<TruthOrDareState | null>(null)
  const [neverHaveI, setNeverHaveI] = useState<NeverHaveIState | null>(null)
  const [celebrityGuess, setCelebrityGuess] = useState<CelebrityGuessState | null>(null)
  const [hangman, setHangman] = useState<HangmanState | null>(null)
  const [ticTacToe, setTicTacToe] = useState<TicTacToeState | null>(null)
  const [dotsBoxes, setDotsBoxes] = useState<DotsBoxesState | null>(null)
  const [wordChain, setWordChain] = useState<WordChainState | null>(null)

  const [secretDraft, setSecretDraft] = useState('')
  const [guessDraft, setGuessDraft] = useState('')
  const [celebGuessDraft, setCelebGuessDraft] = useState('')
  const [hangmanWordDraft, setHangmanWordDraft] = useState('')
  const [hangmanLetterDraft, setHangmanLetterDraft] = useState('')
  const [wordChainDraft, setWordChainDraft] = useState('')
  const [onlineNameDraft, setOnlineNameDraft] = useState(profile.players[0] || '')
  const [onlineColorDraft, setOnlineColorDraft] = useState(profile.playerColors[0])
  const [onlineCodeDraft, setOnlineCodeDraft] = useState('')
  const [onlineBusyAction, setOnlineBusyAction] = useState<'create' | 'join' | 'start' | 'sync' | null>(null)
  const [onlineError, setOnlineError] = useState('')
  const [onlineSession, setOnlineSession] = useState<OnlineSessionState | null>(null)
  const [homeMode, setHomeMode] = useState<HomeMode>('same-screen')
  const [uiClock, setUiClock] = useState(() => Date.now())
  const [raceClock, setRaceClock] = useState(() => Date.now())
  const onlineChannelRef = useRef<RealtimeChannel | null>(null)
  const raceSpaceHeldRef = useRef(false)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  }, [profile])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setUiClock(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  const playersReady = profile.players[0].trim() && profile.players[1].trim()
  const onlinePlayReady = isOnlinePlayConfigured()
  const nextReward = REWARDS.find(
    (reward) => !profile.unlockedRewardIds.includes(reward.id),
  )

  const meterProgress = useMemo(() => {
    if (!nextReward) {
      return 100
    }

    const previousThreshold =
      REWARDS.findLast(
        (reward) => profile.bondScore >= reward.threshold,
      )?.threshold ?? 0
    const span = nextReward.threshold - previousThreshold
    const completed = profile.bondScore - previousThreshold

    return Math.max(4, Math.min(100, (completed / span) * 100))
  }, [nextReward, profile.bondScore])

  const currentPlayerName = (index: PlayerIndex) =>
    profile.players[index] || (index === 0 ? 'Player One' : 'Player Two')

  const partnerOf = (index: PlayerIndex) => (index === 0 ? 1 : 0) as PlayerIndex

  const currentOnlinePlayerIndex = onlineSession ? roleToPlayerIndex(onlineSession.role) : null
  const onlinePlayerName = (index: PlayerIndex) =>
    onlineSession?.players[index] || (index === 0 ? 'Host' : 'Guest')

  const mergeOnlineRaceProgress = (
    playerIndex: PlayerIndex,
    taps: number,
    progress: number,
    message?: string,
  ) => {
    setOnlineSession((current) => {
      if (!current) {
        return current
      }

      const payload = readOnlinePayload(current.roomState.payload)
      if (!payload.raceDash) {
        return current
      }

      const nextTaps = [...payload.raceDash.taps] as [number, number]
      const nextProgress = [...payload.raceDash.progress] as [number, number]
      nextTaps[playerIndex] = Math.max(nextTaps[playerIndex], taps)
      nextProgress[playerIndex] = Math.max(nextProgress[playerIndex], progress)

      const nextPayload: OnlineRoomPayload = {
        ...payload,
        raceDash: {
          ...payload.raceDash,
          taps: nextTaps,
          progress: nextProgress,
          statusMessage: message ?? payload.raceDash.statusMessage,
        },
      }

      return {
        ...current,
        roomState: buildOnlineRoomState(
          nextPayload,
          current.roomState.activeGame,
          current.roomState.phase,
          current.roomState.turn,
        ),
      }
    })
  }

  useEffect(() => {
    if (!onlineSession?.roomCode) {
      return
    }

    let isCancelled = false

    const pullLatestRoom = async () => {
      try {
        const room = await getOnlineRoom(onlineSession.roomCode)
        if (isCancelled) {
          return
        }

        setOnlineSession((current) => {
          if (!current) {
            return current
          }

          const mergedRoom = mergeIncomingRoomWithCurrentState(room, current.roomState)

          return {
            ...hydrateOnlineSessionFromRoom(mergedRoom, current.role, current.onlineCount),
            connectionStatus: 'live',
          }
        })
      } catch {
        if (isCancelled) {
          return
        }

        setOnlineSession((current) =>
          current
            ? {
                ...current,
                connectionStatus: 'error',
                errorMessage: 'Room sync is delayed. Retrying...',
              }
            : current,
        )
      }
    }

    const channel = subscribeToOnlineRoom(onlineSession.roomCode, {
      onRoomEvent: (event, payload) => {
        if (event === 'race-progress') {
          const playerIndex = Number(payload.playerIndex) as PlayerIndex
          const taps = Number(payload.taps)
          const progress = Number(payload.progress)
          if (
            Number.isInteger(playerIndex) &&
            (playerIndex === 0 || playerIndex === 1) &&
            Number.isFinite(taps) &&
            Number.isFinite(progress)
          ) {
            mergeOnlineRaceProgress(playerIndex, taps, progress, payload.message as string | undefined)
          }
          return
        }

        if (event !== 'state-sync' || !payload.room) {
          return
        }

        const room = payload.room as GameRoom
        setOnlineSession((current) => {
          if (!current) {
            return current
          }

          const mergedRoom = mergeIncomingRoomWithCurrentState(room, current.roomState)

          return {
            ...hydrateOnlineSessionFromRoom(mergedRoom, current.role, current.onlineCount),
            connectionStatus: 'live',
          }
        })
        setScreen('online-room')
      },
      onPresenceSync: (onlineCount) => {
        setOnlineSession((current) =>
          current
            ? {
                ...current,
                onlineCount,
                connectionStatus: 'live',
              }
            : current,
        )
      },
    })

    onlineChannelRef.current = channel
    void pullLatestRoom()
    const pollHandle = window.setInterval(() => {
      void pullLatestRoom()
    }, 1800)

    return () => {
      isCancelled = true
      window.clearInterval(pollHandle)
      releaseOnlineRoomSubscription(channel)
      if (onlineChannelRef.current === channel) {
        onlineChannelRef.current = null
      }
    }
  }, [onlineSession?.roomCode])

  const applyMatchResult = (game: string, winner: string, points: number, summary: string) => {
    const nextScore = profile.bondScore + points
    const unlockedRewardIds = getUnlockedRewardIds(nextScore)
    const newlyUnlocked = unlockedRewardIds.filter(
      (rewardId) => !profile.unlockedRewardIds.includes(rewardId),
    )

    setProfile((current) => ({
      ...current,
      bondScore: current.bondScore + points,
      unlockedRewardIds,
      matchesPlayed: current.matchesPlayed + 1,
      history: [
        {
          id: `${Date.now()}-${game}`,
          game,
          winner,
          points,
          summary,
        },
        ...current.history,
      ].slice(0, 10),
    }))

    return newlyUnlocked.length
  }

  const getHeroOutcome = (): SessionWinner => {
    if (screen === 'number-duel' && numberDuel?.view === 'result') {
      return numberDuel.winner
    }
    if (screen === 'mine-matrix' && mineMatrix?.view === 'result') {
      return mineMatrix.winner
    }
    if (screen === 'truth-dare' && truthOrDare?.view === 'result') {
      return truthOrDare.winner
    }
    if (screen === 'never-have-i-ever' && neverHaveI?.view === 'result') {
      return 'both'
    }
    if (screen === 'celebrity-guess' && celebrityGuess?.view === 'result') {
      return celebrityGuess.winner
    }
    if (screen === 'hangman' && hangman?.view === 'result') {
      return hangman.winner
    }
    if (screen === 'tic-tac-toe' && ticTacToe?.view === 'result') {
      return ticTacToe.winner
    }
    if (screen === 'dots-boxes' && dotsBoxes?.view === 'result') {
      return dotsBoxes.winner
    }
    if (screen === 'word-chain' && wordChain?.view === 'result') {
      return wordChain.winner
    }

    return null
  }

  const getHeroCharacterMood = (playerIndex: PlayerIndex): CharacterMood => {
    const outcome = getHeroOutcome()
    if (outcome === null) {
      return 'happy'
    }
    if (outcome === 'both' || outcome === 'draw') {
      return 'happy'
    }

    return outcome === playerIndex ? 'happy' : 'sad'
  }

  const getHeroCharacterEnergy = (playerIndex: PlayerIndex): CharacterEnergy => {
    const outcome = getHeroOutcome()
    if (outcome === null) {
      return 'none'
    }
    if (outcome === 'both' || outcome === 'draw') {
      return 'winner'
    }

    return outcome === playerIndex ? 'winner' : 'loser'
  }

  const broadcastOnlineSnapshot = async (room: GameRoom) => {
    try {
      if (onlineChannelRef.current) {
        const result = await onlineChannelRef.current.send({
          type: 'broadcast',
          event: 'state-sync',
          payload: { room },
        })

        if (result === 'ok') {
          return
        }
      }
    } catch {
      // Fall back to a direct room broadcast below.
    }

    try {
      await broadcastRoomEvent(room.code, 'state-sync', {
        room: room as unknown as Record<string, unknown>,
      })
    } catch {
      // Realtime delivery is a convenience layer for the prototype. The row save still succeeds.
    }
  }

  const refreshOnlineRoom = async () => {
    if (!onlineSession) {
      return
    }

    try {
      const room = await getOnlineRoom(onlineSession.roomCode)
      setOnlineSession((current) =>
        current
          ? {
              ...hydrateOnlineSessionFromRoom(
                mergeIncomingRoomWithCurrentState(room, current.roomState),
                current.role,
                current.onlineCount,
              ),
              connectionStatus: 'live',
              errorMessage: '',
            }
          : current,
      )
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not refresh the room.')
    }
  }

  const syncOnlineRoomState = async (
    nextRoomState: RoomState,
    updates: Partial<Pick<GameRoom, 'game_key' | 'status' | 'guest_name'>> = {},
  ) => {
    if (!onlineSession) {
      return null
    }

    const updatedRoom = await saveOnlineRoomState(onlineSession.roomId, nextRoomState, updates)
    setOnlineSession((current) =>
      current
        ? {
            ...hydrateOnlineSessionFromRoom(updatedRoom, current.role, current.onlineCount),
            connectionStatus: 'live',
          }
        : current,
    )
    await broadcastOnlineSnapshot(updatedRoom)

    return updatedRoom
  }

  const openSetup = () => {
    setSetupNames([profile.players[0], profile.players[1]])
    setSetupColors([profile.playerColors[0], profile.playerColors[1]])
    setScreen('setup')
  }

  const leaveOnlineRoom = () => {
    setOnlineSession(null)
    setOnlineError('')
    setOnlineCodeDraft('')
    setSecretDraft('')
    setGuessDraft('')
    setScreen(playersReady ? 'home' : 'setup')
  }

  const resumeOnlineRoom = () => {
    if (!onlineSession) {
      return
    }

    setHomeMode('online')
    setScreen('online-room')
  }

  const returnOnlineRoomToLobby = async () => {
    if (!onlineSession || onlineSession.role !== 'host') {
      return
    }

    const payload = clearOnlineGames(readOnlinePayload(onlineSession.roomState.payload))
    const nextPayload: OnlineRoomPayload = {
      ...payload,
      lastEvent: 'Back in the room lobby.',
    }

    setOnlineBusyAction('sync')
    try {
      await syncOnlineRoomState(buildOnlineRoomState(nextPayload, 'lobby', 'waiting', 'both'), {
        game_key: 'lobby',
        status: nextPayload.players[1] ? 'ready' : 'waiting',
      })
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not return to the lobby.')
    } finally {
      setOnlineBusyAction(null)
    }
  }

  const sendOnlineEmoji = async (emoji: string) => {
    if (!onlineSession || currentOnlinePlayerIndex === null) {
      return
    }

    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const chat: OnlineEmojiMessage[] = [
      ...payload.chat,
      {
        id: `${new Date().toISOString()}-${currentOnlinePlayerIndex}`,
        player: currentOnlinePlayerIndex,
        emoji,
        createdAt: new Date().toISOString(),
      },
    ].slice(-18)

    try {
      await syncOnlineRoomState(
        buildOnlineRoomState(
          {
            ...payload,
            chat,
            lastEvent: `${onlinePlayerName(currentOnlinePlayerIndex)} sent an emoji.`,
          },
          onlineSession.roomState.activeGame,
          onlineSession.roomState.phase,
          onlineSession.roomState.turn,
        ),
        {
          game_key: onlineSession.roomState.activeGame,
          status:
            onlineSession.roomState.activeGame === 'lobby'
              ? payload.players[1]
                ? 'ready'
                : 'waiting'
              : onlineSession.roomStatus,
        },
      )
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not send the emoji.')
    }
  }

  const createOnlineRoomSession = async () => {
    if (!onlinePlayReady) {
      setOnlineError('Add your Supabase keys before creating an online room.')
      return
    }

    const name = onlineNameDraft.trim()
    if (!name) {
      setOnlineError('Add the player name that should host the room.')
      return
    }

    setOnlineBusyAction('create')
    setOnlineError('')

    try {
      const room = await createOnlineRoom(name)
      const payload = createOnlinePayload(name, onlineColorDraft)
      const roomState = buildOnlineRoomState(payload, 'lobby', 'waiting', 'both')
      const updatedRoom = await saveOnlineRoomState(room.id, roomState, {
        game_key: 'lobby',
        status: 'waiting',
      })
      await broadcastOnlineSnapshot(updatedRoom)

      setOnlineSession({
        ...hydrateOnlineSessionFromRoom(updatedRoom, 'host'),
        connectionStatus: 'connecting',
      })
      setHomeMode('online')
      setScreen('online-room')
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Unable to create room right now.')
    } finally {
      setOnlineBusyAction(null)
    }
  }

  const joinOnlineRoomSession = async () => {
    if (!onlinePlayReady) {
      setOnlineError('Add your Supabase keys before joining an online room.')
      return
    }

    const name = onlineNameDraft.trim()
    const code = onlineCodeDraft.trim().toUpperCase()

    if (!name || !code) {
      setOnlineError('Add your player name and the 6-character room code.')
      return
    }

    setOnlineBusyAction('join')
    setOnlineError('')

    try {
      const room = await joinOnlineRoom(code, name)
      const existingPayload = readOnlinePayload(room.room_state.payload)
      const payload: OnlineRoomPayload = {
        ...existingPayload,
        players: [existingPayload.players[0] || room.host_name, name],
        colors: [existingPayload.colors[0], onlineColorDraft],
        lastEvent: `${name} joined the room.`,
      }

      const roomState = buildOnlineRoomState(payload, room.room_state.activeGame, room.room_state.phase, room.room_state.turn)
      const updatedRoom = await saveOnlineRoomState(room.id, roomState, {
        game_key: room.game_key,
        status: payload.players[0] && payload.players[1] ? 'ready' : room.status,
      })
      await broadcastOnlineSnapshot(updatedRoom)

      setOnlineSession({
        ...hydrateOnlineSessionFromRoom(updatedRoom, 'guest', 2),
        connectionStatus: 'connecting',
      })
      setHomeMode('online')
      setScreen('online-room')
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Unable to join that room right now.')
    } finally {
      setOnlineBusyAction(null)
    }
  }

  const startOnlineNumberDuel = async () => {
    if (!onlineSession || !canStartOnlineGame(onlineSession, 'number-duel')) {
      return
    }

    const payload: OnlineRoomPayload = {
      ...readOnlinePayload(onlineSession.roomState.payload),
      numberDuel: createOnlineNumberDuel(),
      wordChain: null,
      lastEvent: 'Online Number Duel started.',
    }

    setOnlineBusyAction('start')

    try {
      await syncOnlineRoomState(buildOnlineRoomState(payload, 'number-duel', 'setup', 'both'), {
        game_key: 'number-duel',
        status: 'playing',
      })
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not start the online game.')
    } finally {
      setOnlineBusyAction(null)
    }
  }

  const startOnlineRaceDash = async () => {
    if (!onlineSession || !canStartOnlineGame(onlineSession, 'race-dash')) {
      return
    }

    const payload: OnlineRoomPayload = {
      ...readOnlinePayload(onlineSession.roomState.payload),
      numberDuel: null,
      wordChain: null,
      ticTacToe: null,
      raceDash: createOnlineRaceDash(),
      lastEvent: 'Online Race Dash started.',
    }

    setOnlineBusyAction('start')

    try {
      await syncOnlineRoomState(buildOnlineRoomState(payload, 'race-dash', 'countdown', 'both'), {
        game_key: 'race-dash',
        status: 'playing',
      })
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not start the race.')
    } finally {
      setOnlineBusyAction(null)
    }
  }

  const startOnlineTicTacToe = async () => {
    if (!onlineSession || !canStartOnlineGame(onlineSession, 'tic-tac-toe')) {
      return
    }

    const payload: OnlineRoomPayload = {
      ...readOnlinePayload(onlineSession.roomState.payload),
      numberDuel: null,
      wordChain: null,
      raceDash: null,
      ticTacToe: createOnlineTicTacToe(),
      lastEvent: 'Online Tic Tac Toe started.',
    }

    setOnlineBusyAction('start')

    try {
      await syncOnlineRoomState(buildOnlineRoomState(payload, 'tic-tac-toe', 'play', turnForPlayer(0)), {
        game_key: 'tic-tac-toe',
        status: 'playing',
      })
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not start online Tic Tac Toe.')
    } finally {
      setOnlineBusyAction(null)
    }
  }

  async function finalizeOnlineRaceDash(
    winner: SessionWinner,
    statusMessage: string,
    cue: ReactionCue,
  ) {
    if (!onlineSession) {
      return
    }

    const payload = readOnlinePayload(onlineSession.roomState.payload)
    if (!payload.raceDash || payload.raceDash.phase === 'result') {
      return
    }

    const nextRace: OnlineRaceDashState = {
      ...payload.raceDash,
      phase: 'result',
      winner,
      cue,
      statusMessage,
    }

    try {
      await syncOnlineRoomState(
        buildOnlineRoomState(
          {
            ...payload,
            raceDash: nextRace,
            lastEvent: statusMessage,
          },
          'race-dash',
          'result',
          'both',
        ),
        { game_key: 'race-dash', status: 'finished' },
      )
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not finish the race cleanly.')
    }
  }

  async function pushOnlineRaceStep() {
    if (!onlineSession || currentOnlinePlayerIndex === null) {
      return
    }

    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const raceDash = payload.raceDash
    if (!raceDash) {
      return
    }

    const startsAt = new Date(raceDash.startsAt).getTime()
    const endsAt = new Date(raceDash.endsAt).getTime()
    const currentTime = raceClock
    if (currentTime < startsAt || currentTime > endsAt || raceDash.phase === 'result') {
      return
    }

    const taps = [...raceDash.taps] as [number, number]
    const progress = [...raceDash.progress] as [number, number]
    taps[currentOnlinePlayerIndex] += 1
    progress[currentOnlinePlayerIndex] = Math.min(
      100,
      Math.round((taps[currentOnlinePlayerIndex] / raceDash.targetTaps) * 100),
    )

    mergeOnlineRaceProgress(
      currentOnlinePlayerIndex,
      taps[currentOnlinePlayerIndex],
      progress[currentOnlinePlayerIndex],
      `${onlinePlayerName(currentOnlinePlayerIndex)} is charging forward.`,
    )

    try {
      await broadcastRoomEvent(onlineSession.roomCode, 'race-progress', {
        playerIndex: currentOnlinePlayerIndex,
        taps: taps[currentOnlinePlayerIndex],
        progress: progress[currentOnlinePlayerIndex],
        message: `${onlinePlayerName(currentOnlinePlayerIndex)} is charging forward.`,
      })
    } catch {
      // Local UI still updates, and the room poll will eventually reconcile.
    }

    if (progress[currentOnlinePlayerIndex] >= 100) {
      await finalizeOnlineRaceDash(
        currentOnlinePlayerIndex,
        `${onlinePlayerName(currentOnlinePlayerIndex)} crossed the finish line first.`,
        createCue(currentOnlinePlayerIndex, 'Photo finish', 'That sprint was ridiculous.', KISS_HEART, 'win'),
      )
    }
  }

  const finalizeOnlineRaceDashEvent = useEffectEvent(
    (winner: SessionWinner, statusMessage: string, cue: ReactionCue) => {
      void finalizeOnlineRaceDash(winner, statusMessage, cue)
    },
  )

  const pushOnlineRaceStepEvent = useEffectEvent(() => {
    void pushOnlineRaceStep()
  })

  useEffect(() => {
    const payload = onlineSession ? readOnlinePayload(onlineSession.roomState.payload) : null
    const raceDash = payload?.raceDash
    if (!raceDash || (raceDash.phase !== 'countdown' && raceDash.phase !== 'racing')) {
      return
    }

    const interval = window.setInterval(() => {
      setRaceClock(Date.now())
    }, 120)

    return () => {
      window.clearInterval(interval)
    }
  }, [onlineSession])

  useEffect(() => {
    const payload = onlineSession ? readOnlinePayload(onlineSession.roomState.payload) : null
    const raceDash = payload?.raceDash
    if (!raceDash || raceDash.phase === 'result' || currentOnlinePlayerIndex === null) {
      return
    }

    const endsAt = new Date(raceDash.endsAt).getTime()
    const timeoutMs = Math.max(0, endsAt - raceClock)

    const timeout = window.setTimeout(() => {
      if (raceDash.progress[0] === raceDash.progress[1]) {
        finalizeOnlineRaceDashEvent(
          'draw',
          'Race Dash ended in a dead heat.',
          createCue(0, 'Tie race', 'You hit the line together.', KISS_HEART, 'win'),
        )
        return
      }

      const winner = raceDash.progress[0] > raceDash.progress[1] ? 0 : 1
      const winnerName = onlineSession?.players[winner] || (winner === 0 ? 'Host' : 'Guest')
      finalizeOnlineRaceDashEvent(
        winner,
        `${winnerName} covered more distance before the timer ran out.`,
        createCue(winner, 'Time', 'You held the lead when the clock hit zero.', KISS_HEART, 'win'),
      )
    }, timeoutMs)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [currentOnlinePlayerIndex, onlineSession, raceClock])

  useEffect(() => {
    const payload = onlineSession ? readOnlinePayload(onlineSession.roomState.payload) : null
    const raceDash = payload?.raceDash
    if (!raceDash || currentOnlinePlayerIndex === null) {
      return
    }

    const startsAt = new Date(raceDash.startsAt).getTime()
    const endsAt = new Date(raceDash.endsAt).getTime()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        return
      }

      if (event.repeat || raceSpaceHeldRef.current) {
        event.preventDefault()
        return
      }

      if (raceClock < startsAt || raceClock > endsAt || raceDash.phase === 'result') {
        return
      }

      raceSpaceHeldRef.current = true
      event.preventDefault()
      pushOnlineRaceStepEvent()
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        raceSpaceHeldRef.current = false
      }
    }

      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
      return () => {
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup', onKeyUp)
        raceSpaceHeldRef.current = false
      }
  }, [currentOnlinePlayerIndex, onlineSession, raceClock])

  const submitOnlineSecret = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!onlineSession) {
      return
    }

    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.numberDuel
    const playerIndex = roleToPlayerIndex(onlineSession.role)

    if (!game || game.phase !== 'setup' || game.ready[playerIndex]) {
      return
    }

    const parsedSecret = Number(secretDraft)
    if (!Number.isInteger(parsedSecret) || parsedSecret < 1 || parsedSecret > 999) {
      return
    }

    const ready = [...game.ready] as [boolean, boolean]
    const secrets = [...game.secrets] as [number | null, number | null]
    ready[playerIndex] = true
    secrets[playerIndex] = parsedSecret

    const nextGame: OnlineNumberDuelState = {
      ...game,
      ready,
      secrets,
      cue: createCue(playerIndex, 'Secret locked', 'Waiting for the other number to lock in.', THUMBS_UP, 'soft'),
      statusMessage:
        ready[0] && ready[1]
          ? `${payload.players[0]} guesses first.`
          : `${onlinePlayerName(playerIndex)} is ready. Waiting for the other player.`,
    }

    if (ready[0] && ready[1]) {
      nextGame.phase = 'guess'
      nextGame.currentTurn = 0
      nextGame.trackers = [createTracker(secrets[1] as number), createTracker(secrets[0] as number)]
      nextGame.cue = createCue(1, 'Both secrets locked', `${payload.players[0]} opens the guessing.`, KISS_HEART, 'success')
    }

    try {
      await syncOnlineRoomState(
        buildOnlineRoomState(
          {
            ...payload,
            numberDuel: nextGame,
            lastEvent: `${onlinePlayerName(playerIndex)} locked a secret number.`,
          },
          'number-duel',
          nextGame.phase,
          ready[0] && ready[1] ? turnForPlayer(0) : 'both',
        ),
        { game_key: 'number-duel', status: 'playing' },
      )
      setSecretDraft('')
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not save your secret.')
    }
  }

  const submitOnlineGuess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!onlineSession) {
      return
    }

    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.numberDuel
    const playerIndex = roleToPlayerIndex(onlineSession.role)

    if (!game || game.phase !== 'guess' || game.currentTurn !== playerIndex) {
      return
    }

    const tracker = game.trackers[playerIndex]
    if (!tracker) {
      return
    }

    const parsedGuess = Number(guessDraft)
    if (!Number.isInteger(parsedGuess) || parsedGuess < tracker.min || parsedGuess > tracker.max) {
      return
    }

    const trackers = [...game.trackers] as [GuessTracker, GuessTracker]
    const updatedTracker: GuessTracker = {
      ...tracker,
      attempts: tracker.attempts + 1,
      recentHints: tracker.recentHints,
    }

    if (parsedGuess === tracker.target) {
      trackers[playerIndex] = {
        ...updatedTracker,
        recentHints: [
          `${onlinePlayerName(playerIndex)} guessed ${parsedGuess} exactly in ${updatedTracker.attempts} tries.`,
          ...tracker.recentHints,
        ].slice(0, 4),
      }

      const nextGame: OnlineNumberDuelState = {
        ...game,
        phase: 'result',
        trackers,
        winner: playerIndex,
        cue: createCue(playerIndex, 'Exactly right', 'That read was sharp.', KISS_HEART, 'win'),
        statusMessage: `${onlinePlayerName(playerIndex)} guessed the number and wins the online duel.`,
      }

      try {
        await syncOnlineRoomState(
          buildOnlineRoomState(
            {
              ...payload,
              numberDuel: nextGame,
              lastEvent: `${onlinePlayerName(playerIndex)} won the online duel.`,
            },
            'number-duel',
            'result',
            turnForPlayer(playerIndex),
          ),
          { game_key: 'number-duel', status: 'finished' },
        )
        setGuessDraft('')
      } catch (error) {
        setOnlineError(error instanceof Error ? error.message : 'Could not save that guess.')
      }
      return
    }

    const clue = parsedGuess < tracker.target ? 'Higher' : 'Lower'
    const previousRangeSize = tracker.max - tracker.min + 1
    updatedTracker.min =
      parsedGuess < tracker.target ? Math.max(tracker.min, parsedGuess + 1) : tracker.min
    updatedTracker.max =
      parsedGuess > tracker.target ? Math.min(tracker.max, parsedGuess - 1) : tracker.max
    const nextRangeSize = updatedTracker.max - updatedTracker.min + 1
    const isBigCut = nextRangeSize <= previousRangeSize / 2
    updatedTracker.recentHints = [
      `${onlinePlayerName(playerIndex)} guessed ${parsedGuess}. ${clue}.`,
      ...tracker.recentHints,
    ].slice(0, 4)
    trackers[playerIndex] = updatedTracker

    const nextTurn = partnerOf(playerIndex)
    const nextGame: OnlineNumberDuelState = {
      ...game,
      phase: 'reveal',
      trackers,
      currentTurn: nextTurn,
      cue: createCue(
        nextTurn,
        clue,
        isBigCut ? 'Good job' : 'Keep it up',
        isBigCut ? KISS_HEART : THUMBS_UP,
        clue === 'Higher' ? 'higher' : 'lower',
      ),
      statusMessage: `${onlinePlayerName(nextTurn)} is up next.`,
    }

    try {
      await syncOnlineRoomState(
        buildOnlineRoomState(
          {
            ...payload,
            numberDuel: nextGame,
            lastEvent: `${onlinePlayerName(playerIndex)} guessed ${parsedGuess}.`,
          },
          'number-duel',
          'reveal',
          turnForPlayer(nextTurn),
        ),
        { game_key: 'number-duel', status: 'playing' },
      )
      setGuessDraft('')
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not save that guess.')
    }
  }

  const advanceOnlineReveal = async () => {
    if (!onlineSession) {
      return
    }

    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.numberDuel

    if (!game || game.phase !== 'reveal') {
      return
    }

    const nextGame: OnlineNumberDuelState = {
      ...game,
      phase: 'guess',
      cue: null,
      statusMessage: `${onlinePlayerName(game.currentTurn)} is guessing now.`,
    }

    try {
      await syncOnlineRoomState(
        buildOnlineRoomState(
          {
            ...payload,
            numberDuel: nextGame,
            lastEvent: `${onlinePlayerName(game.currentTurn)} started the next turn.`,
          },
          'number-duel',
          'guess',
          turnForPlayer(game.currentTurn),
        ),
        { game_key: 'number-duel', status: 'playing' },
      )
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not advance the turn.')
    }
  }

  const playOnlineTicTacToeMove = async (cell: number) => {
    if (!onlineSession) {
      return
    }

    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.ticTacToe
    const playerIndex = roleToPlayerIndex(onlineSession.role)

    if (!game || game.phase !== 'play' || game.currentTurn !== playerIndex || game.board[cell] !== null) {
      return
    }

    const board = [...game.board]
    board[cell] = playerIndex
    const winner = getTicWinner(board)

    if (winner !== null) {
      const nextGame: OnlineTicTacToeState = {
        ...game,
        board,
        phase: 'result',
        winner,
        cue: createCue(winner, 'Three in a row', 'Clean win.', KISS_HEART, 'win'),
        statusMessage: `${onlinePlayerName(winner)} wins Online Tic Tac Toe.`,
      }

      try {
        await syncOnlineRoomState(
          buildOnlineRoomState(
            {
              ...payload,
              ticTacToe: nextGame,
              lastEvent: `${onlinePlayerName(winner)} won Online Tic Tac Toe.`,
            },
            'tic-tac-toe',
            'result',
            'both',
          ),
          { game_key: 'tic-tac-toe', status: 'finished' },
        )
      } catch (error) {
        setOnlineError(error instanceof Error ? error.message : 'Could not save the winning move.')
      }
      return
    }

    if (board.every((value) => value !== null)) {
      const nextGame: OnlineTicTacToeState = {
        ...game,
        board,
        phase: 'result',
        winner: 'draw',
        cue: createCue(0, 'Draw board', 'That was tight all the way through.', THUMBS_UP, 'soft'),
        statusMessage: 'Online Tic Tac Toe ended in a draw.',
      }

      try {
        await syncOnlineRoomState(
          buildOnlineRoomState(
            {
              ...payload,
              ticTacToe: nextGame,
              lastEvent: 'Online Tic Tac Toe ended in a draw.',
            },
            'tic-tac-toe',
            'result',
            'both',
          ),
          { game_key: 'tic-tac-toe', status: 'finished' },
        )
      } catch (error) {
        setOnlineError(error instanceof Error ? error.message : 'Could not save the draw state.')
      }
      return
    }

    const nextTurn = partnerOf(playerIndex)
    const nextGame: OnlineTicTacToeState = {
      ...game,
      board,
      currentTurn: nextTurn,
      cue: createCue(nextTurn, 'Your move', `${onlinePlayerName(nextTurn)} is up.`, THUMBS_UP, 'success'),
      statusMessage: `${onlinePlayerName(nextTurn)} is up next.`,
    }

    try {
      await syncOnlineRoomState(
        buildOnlineRoomState(
          {
            ...payload,
            ticTacToe: nextGame,
            lastEvent: `${onlinePlayerName(playerIndex)} placed a mark.`,
          },
          'tic-tac-toe',
          'play',
          turnForPlayer(nextTurn),
        ),
        { game_key: 'tic-tac-toe', status: 'playing' },
      )
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not save that move.')
    }
  }

  const startOnlineMineMatrix = async () => {
    if (!onlineSession || !canStartOnlineGame(onlineSession, 'mine-matrix')) {
      return
    }

    const payload: OnlineRoomPayload = {
      ...readOnlinePayload(onlineSession.roomState.payload),
      numberDuel: null,
      wordChain: null,
      raceDash: null,
      ticTacToe: null,
      truthOrDare: null,
      neverHaveI: null,
      celebrityGuess: null,
      hangman: null,
      dotsBoxes: null,
      mineMatrix: createOnlineMineMatrix(),
      lastEvent: 'Online Mine Matrix started.',
    }

    setOnlineBusyAction('start')
    try {
      await syncOnlineRoomState(buildOnlineRoomState(payload, 'mine-matrix', 'setup', 'both'), {
        game_key: 'mine-matrix',
        status: 'playing',
      })
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not start Online Mine Matrix.')
    } finally {
      setOnlineBusyAction(null)
    }
  }

  const toggleOnlineMineSelection = async (cell: number) => {
    if (!onlineSession || currentOnlinePlayerIndex === null) {
      return
    }

    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.mineMatrix
    if (!game || game.phase !== 'setup' || game.ready[currentOnlinePlayerIndex]) {
      return
    }

    const selections = [...game.plantingSelections] as [number[], number[]]
    const currentSelections = selections[currentOnlinePlayerIndex]
    if (includesCell(currentSelections, cell)) {
      selections[currentOnlinePlayerIndex] = currentSelections.filter((value) => value !== cell)
    } else if (currentSelections.length < 3) {
      selections[currentOnlinePlayerIndex] = [...currentSelections, cell]
    } else {
      return
    }

    try {
      await syncOnlineRoomState(
        buildOnlineRoomState(
          {
            ...payload,
            mineMatrix: {
              ...game,
              plantingSelections: selections,
              statusMessage: `${onlinePlayerName(currentOnlinePlayerIndex)} is placing mines.`,
            },
            lastEvent: `${onlinePlayerName(currentOnlinePlayerIndex)} is placing mines.`,
          },
          'mine-matrix',
          'setup',
          'both',
        ),
        { game_key: 'mine-matrix', status: 'playing' },
      )
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not update mine placement.')
    }
  }

  const confirmOnlineMineSetup = async () => {
    if (!onlineSession || currentOnlinePlayerIndex === null) {
      return
    }

    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.mineMatrix
    if (!game || game.phase !== 'setup') {
      return
    }

    const selections = game.plantingSelections[currentOnlinePlayerIndex]
    if (selections.length !== 3) {
      return
    }

    const ready = [...game.ready] as [boolean, boolean]
    ready[currentOnlinePlayerIndex] = true
    const mineBoards = [...game.mineBoards] as [number[], number[]]
    mineBoards[currentOnlinePlayerIndex] = [...selections]

    const nextGame: OnlineMineMatrixState = {
      ...game,
      ready,
      mineBoards,
      cue: createCue(currentOnlinePlayerIndex, 'Board locked', 'Waiting for the other player.', THUMBS_UP, 'soft'),
      statusMessage:
        ready[0] && ready[1]
          ? `${onlinePlayerName(0)} begins the guessing round.`
          : `${onlinePlayerName(currentOnlinePlayerIndex)} locked a board.`,
    }

    if (ready[0] && ready[1]) {
      nextGame.phase = 'play'
      nextGame.currentTurn = 0
      nextGame.cue = createCue(1, 'All mines are hidden', 'Host takes the first bite.', KISS_HEART, 'soft')
    }

    try {
      await syncOnlineRoomState(
        buildOnlineRoomState(
          {
            ...payload,
            mineMatrix: nextGame,
            lastEvent: `${onlinePlayerName(currentOnlinePlayerIndex)} locked a mine layout.`,
          },
          'mine-matrix',
          nextGame.phase,
          ready[0] && ready[1] ? turnForPlayer(0) : 'both',
        ),
        { game_key: 'mine-matrix', status: 'playing' },
      )
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not lock the mine layout.')
    }
  }

  const revealOnlineMineCell = async (cell: number) => {
    if (!onlineSession || currentOnlinePlayerIndex === null) {
      return
    }

    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.mineMatrix
    if (!game || game.phase !== 'play' || game.currentTurn !== currentOnlinePlayerIndex) {
      return
    }

    const attacker = currentOnlinePlayerIndex
    const defender = partnerOf(attacker)
    if (includesCell(game.revealedBoards[defender], cell)) {
      return
    }

    const revealedBoards = [...game.revealedBoards] as [number[], number[]]
    revealedBoards[defender] = [...revealedBoards[defender], cell]
    const mineHits = [...game.mineHits] as [number, number]
    const hitMine = includesCell(game.mineBoards[defender], cell)
    if (hitMine) {
      mineHits[attacker] += 1
    }

    const nextTurn = defender
    const nextGame: OnlineMineMatrixState = {
      ...game,
      phase: 'reveal',
      revealedBoards,
      mineHits,
      currentTurn: nextTurn,
      pendingCell: cell,
      pendingTarget: defender,
      pendingHit: hitMine,
      nextTurn,
      resolvingResult: hitMine && mineHits[attacker] >= 3,
      winner: hitMine && mineHits[attacker] >= 3 ? defender : null,
      cue: createCue(
        defender,
        hitMine ? 'Boom' : 'Safe',
        hitMine
          ? mineHits[attacker] >= 3
            ? 'That hit ends the round.'
            : 'That bite hurt. Look at the board before switching.'
          : 'Safe pick. The board stays up for a beat.',
        hitMine ? MINE_ICON : SAFE_ICON,
        hitMine ? 'warning' : 'success',
      ),
      statusMessage: hitMine
        ? `${onlinePlayerName(attacker)} hit a mine.`
        : `${onlinePlayerName(attacker)} found a safe bite.`,
    }

    try {
      await syncOnlineRoomState(
        buildOnlineRoomState(
          { ...payload, mineMatrix: nextGame, lastEvent: `${onlinePlayerName(attacker)} revealed a cell.` },
          'mine-matrix',
          'reveal',
          'both',
        ),
        { game_key: 'mine-matrix', status: 'playing' },
      )
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not reveal that cell.')
    }
  }

  const advanceOnlineMineReveal = async () => {
    if (!onlineSession) {
      return
    }

    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.mineMatrix
    if (!game || game.phase !== 'reveal') {
      return
    }

    if (game.resolvingResult && game.winner !== null) {
      const winner = game.winner
      const nextGame: OnlineMineMatrixState = {
        ...game,
        phase: 'result',
        cue: createCue(winner, 'Final strike', 'Safe and steady wins this one.', KISS_HEART, 'win'),
        statusMessage: `${onlinePlayerName(winner)} wins Online Mine Matrix.`,
      }

      try {
        await syncOnlineRoomState(
          buildOnlineRoomState(
            { ...payload, mineMatrix: nextGame, lastEvent: `${onlinePlayerName(winner)} won Online Mine Matrix.` },
            'mine-matrix',
            'result',
            'both',
          ),
          { game_key: 'mine-matrix', status: 'finished' },
        )
      } catch (error) {
        setOnlineError(error instanceof Error ? error.message : 'Could not finish Mine Matrix.')
      }
      return
    }

    const nextTurn = game.nextTurn ?? game.currentTurn
    const nextGame: OnlineMineMatrixState = {
      ...game,
      phase: 'play',
      currentTurn: nextTurn,
      pendingCell: null,
      pendingTarget: null,
      pendingHit: null,
      nextTurn: null,
      resolvingResult: false,
      cue: createCue(nextTurn, 'Your turn', `${onlinePlayerName(nextTurn)} is up next.`, THUMBS_UP, 'soft'),
      statusMessage: `${onlinePlayerName(nextTurn)} is up next.`,
    }

    try {
      await syncOnlineRoomState(
        buildOnlineRoomState(
          { ...payload, mineMatrix: nextGame, lastEvent: `${onlinePlayerName(nextTurn)} starts the next Mine Matrix turn.` },
          'mine-matrix',
          'play',
          turnForPlayer(nextTurn),
        ),
        { game_key: 'mine-matrix', status: 'playing' },
      )
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not continue Mine Matrix.')
    }
  }

  const startOnlineWordChain = async () => {
    if (!onlineSession || !canStartOnlineGame(onlineSession, 'word-chain')) {
      return
    }

    const payload: OnlineRoomPayload = {
      ...readOnlinePayload(onlineSession.roomState.payload),
      numberDuel: null,
      wordChain: createOnlineWordChain(),
      raceDash: null,
      ticTacToe: null,
      mineMatrix: null,
      truthOrDare: null,
      neverHaveI: null,
      celebrityGuess: null,
      hangman: null,
      dotsBoxes: null,
      lastEvent: 'Online Word Chain started.',
    }

    setOnlineBusyAction('start')
    try {
      await syncOnlineRoomState(buildOnlineRoomState(payload, 'word-chain', 'play', turnForPlayer(0)), {
        game_key: 'word-chain',
        status: 'playing',
      })
      setWordChainDraft('')
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not start Online Word Chain.')
    } finally {
      setOnlineBusyAction(null)
    }
  }

  const submitOnlineWordChainWord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!onlineSession || currentOnlinePlayerIndex === null) {
      return
    }

    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.wordChain
    if (!game || game.phase !== 'play' || game.currentPlayer !== currentOnlinePlayerIndex) {
      return
    }

    const normalizedWord = normalizeWord(wordChainDraft)
    if (!normalizedWord) {
      setOnlineError(`Enter a real word starting with ${game.requiredLetter}.`)
      return
    }

    if (!normalizedWord.startsWith(game.requiredLetter.toLowerCase())) {
      setOnlineError(`That word needs to start with ${game.requiredLetter}.`)
      return
    }

    if (game.usedWords.includes(normalizedWord)) {
      setOnlineError('That word was already used in this chain.')
      return
    }

    setOnlineBusyAction('sync')
    setOnlineError('')

    const isValidWord = await validateDictionaryWord(normalizedWord)
    if (!isValidWord) {
      setOnlineBusyAction(null)
      setOnlineError('That word did not pass the dictionary check.')
      return
    }

    const nextLetter = getTerminalLetter(normalizedWord)
    const nextPlayer = partnerOf(currentOnlinePlayerIndex)
    const nextHistory = [
      ...game.history,
      {
        player: currentOnlinePlayerIndex,
        word: normalizedWord.toUpperCase(),
      },
    ]

    const nextGame: OnlineWordChainState = {
      ...game,
      currentPlayer: nextPlayer,
      requiredLetter: nextLetter.toUpperCase(),
      history: nextHistory,
      usedWords: [...game.usedWords, normalizedWord],
      cue: createCue(
        nextPlayer,
        'Good chain',
        `${onlinePlayerName(nextPlayer)} needs a word that starts with ${nextLetter.toUpperCase()}.`,
        nextHistory.length >= 5 ? KISS_HEART : THUMBS_UP,
        nextHistory.length >= 5 ? 'success' : 'soft',
      ),
      statusMessage: `${onlinePlayerName(nextPlayer)} now needs a word that starts with ${nextLetter.toUpperCase()}.`,
    }

    try {
      await syncOnlineRoomState(
        buildOnlineRoomState(
          {
            ...payload,
            wordChain: nextGame,
            lastEvent: `${onlinePlayerName(currentOnlinePlayerIndex)} played ${normalizedWord.toUpperCase()}.`,
          },
          'word-chain',
          'play',
          turnForPlayer(nextPlayer),
        ),
        { game_key: 'word-chain', status: 'playing' },
      )
      setWordChainDraft('')
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not save that word.')
    } finally {
      setOnlineBusyAction(null)
    }
  }

  const giveUpOnlineWordChain = async () => {
    if (!onlineSession || currentOnlinePlayerIndex === null) {
      return
    }

    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.wordChain
    if (!game || game.phase !== 'play') {
      return
    }

    const winner = partnerOf(currentOnlinePlayerIndex)
    const summary = `${onlinePlayerName(winner)} wins after a ${game.history.length}-word online chain.`
    const nextGame: OnlineWordChainState = {
      ...game,
      phase: 'result',
      winner,
      resultSummary: summary,
      cue: createCue(winner, 'Chain snapped', `${onlinePlayerName(currentOnlinePlayerIndex)} tapped out.`, KISS_HEART, 'win'),
      statusMessage: summary,
    }

    setOnlineBusyAction('sync')
    setOnlineError('')

    try {
      await syncOnlineRoomState(
        buildOnlineRoomState(
          {
            ...payload,
            wordChain: nextGame,
            lastEvent: `${onlinePlayerName(currentOnlinePlayerIndex)} gave up the word chain.`,
          },
          'word-chain',
          'result',
          'both',
        ),
        { game_key: 'word-chain', status: 'finished' },
      )
      setWordChainDraft('')
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not finish Online Word Chain.')
    } finally {
      setOnlineBusyAction(null)
    }
  }

  const startOnlineTruthOrDare = async () => {
    if (!onlineSession || !canStartOnlineGame(onlineSession, 'truth-dare')) {
      return
    }

    const payload: OnlineRoomPayload = {
      ...readOnlinePayload(onlineSession.roomState.payload),
      numberDuel: null,
      wordChain: null,
      raceDash: null,
      ticTacToe: null,
      mineMatrix: null,
      neverHaveI: null,
      celebrityGuess: null,
      hangman: null,
      dotsBoxes: null,
      truthOrDare: createOnlineTruthOrDare(),
      lastEvent: 'Online Truth or Dare started.',
    }

    setOnlineBusyAction('start')
    try {
      await syncOnlineRoomState(buildOnlineRoomState(payload, 'truth-dare', 'choose', turnForPlayer(0)), {
        game_key: 'truth-dare',
        status: 'playing',
      })
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not start Online Truth or Dare.')
    } finally {
      setOnlineBusyAction(null)
    }
  }

  const drawOnlineTruthOrDareCard = async (kind: TruthKind) => {
    if (!onlineSession || currentOnlinePlayerIndex === null) {
      return
    }
    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.truthOrDare
    if (!game || game.phase !== 'choose' || game.currentPlayer !== currentOnlinePlayerIndex) {
      return
    }

    const prompt =
      kind === 'Truth'
        ? TRUTH_PROMPTS[game.truthIndex % TRUTH_PROMPTS.length]
        : DARE_PROMPTS[game.dareIndex % DARE_PROMPTS.length]
    const nextGame: OnlineTruthOrDareState = {
      ...game,
      phase: 'card',
      activeCard: { kind, prompt },
      truthIndex: kind === 'Truth' ? game.truthIndex + 1 : game.truthIndex,
      dareIndex: kind === 'Dare' ? game.dareIndex + 1 : game.dareIndex,
      cue: createCue(
        partnerOf(currentOnlinePlayerIndex),
        kind === 'Truth' ? 'Tell the truth' : 'I dare you',
        'Complete the card when you are done.',
        KISS_HEART,
        kind === 'Truth' ? 'truth' : 'dare',
      ),
      statusMessage: `${onlinePlayerName(currentOnlinePlayerIndex)} drew a ${kind} card.`,
    }

    try {
      await syncOnlineRoomState(
        buildOnlineRoomState(
          { ...payload, truthOrDare: nextGame, lastEvent: `${onlinePlayerName(currentOnlinePlayerIndex)} drew ${kind}.` },
          'truth-dare',
          'card',
          turnForPlayer(currentOnlinePlayerIndex),
        ),
        { game_key: 'truth-dare', status: 'playing' },
      )
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not draw the card.')
    }
  }

  const completeOnlineTruthOrDareCard = async () => {
    if (!onlineSession || currentOnlinePlayerIndex === null) {
      return
    }
    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.truthOrDare
    if (!game || game.phase !== 'card' || game.currentPlayer !== currentOnlinePlayerIndex) {
      return
    }

    const scores = [...game.scores] as [number, number]
    scores[currentOnlinePlayerIndex] += 1
    const isLastRound = game.round >= game.totalRounds

    if (isLastRound) {
      const winner: SessionWinner = scores[0] === scores[1] ? 'both' : scores[0] > scores[1] ? 0 : 1
      const summary =
        winner === 'both'
          ? 'Both players finished Truth or Dare tied.'
          : `${onlinePlayerName(winner)} wins Online Truth or Dare ${scores[0]}-${scores[1]}.`
      const nextGame: OnlineTruthOrDareState = {
        ...game,
        scores,
        phase: 'result',
        winner,
        resultSummary: summary,
        cue: createCue(currentOnlinePlayerIndex, 'Session complete', 'That was a fun one.', KISS_HEART, 'win'),
        statusMessage: summary,
      }

      try {
        await syncOnlineRoomState(
          buildOnlineRoomState(
            { ...payload, truthOrDare: nextGame, lastEvent: summary },
            'truth-dare',
            'result',
            'both',
          ),
          { game_key: 'truth-dare', status: 'finished' },
        )
      } catch (error) {
        setOnlineError(error instanceof Error ? error.message : 'Could not finish Truth or Dare.')
      }
      return
    }

    const nextPlayer = partnerOf(currentOnlinePlayerIndex)
    const nextGame: OnlineTruthOrDareState = {
      ...game,
      scores,
      currentPlayer: nextPlayer,
      round: game.round + 1,
      phase: 'choose',
      activeCard: null,
      cue: createCue(currentOnlinePlayerIndex, 'Good job', `${onlinePlayerName(nextPlayer)} is up next.`, THUMBS_UP, 'success'),
      statusMessage: `${onlinePlayerName(nextPlayer)} chooses next.`,
    }

    try {
      await syncOnlineRoomState(
        buildOnlineRoomState(
          { ...payload, truthOrDare: nextGame, lastEvent: `${onlinePlayerName(currentOnlinePlayerIndex)} completed a card.` },
          'truth-dare',
          'choose',
          turnForPlayer(nextPlayer),
        ),
        { game_key: 'truth-dare', status: 'playing' },
      )
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not advance the round.')
    }
  }

  const startOnlineNeverHaveI = async () => {
    if (!onlineSession || !canStartOnlineGame(onlineSession, 'never-have-i-ever')) {
      return
    }
    const payload: OnlineRoomPayload = {
      ...readOnlinePayload(onlineSession.roomState.payload),
      numberDuel: null,
      wordChain: null,
      raceDash: null,
      ticTacToe: null,
      mineMatrix: null,
      truthOrDare: null,
      celebrityGuess: null,
      hangman: null,
      dotsBoxes: null,
      neverHaveI: createOnlineNeverHaveI(),
      lastEvent: 'Online Never Have I Ever started.',
    }
    setOnlineBusyAction('start')
    try {
      await syncOnlineRoomState(buildOnlineRoomState(payload, 'never-have-i-ever', 'intro', 'both'), {
        game_key: 'never-have-i-ever',
        status: 'playing',
      })
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not start Online Never Have I Ever.')
    } finally {
      setOnlineBusyAction(null)
    }
  }

  const beginOnlineNeverHaveI = async () => {
    if (!onlineSession) {
      return
    }
    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.neverHaveI
    if (!game || game.phase !== 'intro') {
      return
    }
    const nextGame: OnlineNeverHaveIState = {
      ...game,
      phase: 'answer',
      cue: createCue(1, 'Answer privately', 'Both answers reveal together.', THUMBS_UP, 'soft'),
      statusMessage: 'Both players answer on their own screens.',
    }
    try {
      await syncOnlineRoomState(
        buildOnlineRoomState({ ...payload, neverHaveI: nextGame, lastEvent: 'Both players are answering.' }, 'never-have-i-ever', 'answer', 'both'),
        { game_key: 'never-have-i-ever', status: 'playing' },
      )
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not start answers.')
    }
  }

  const answerOnlineNeverHaveI = async (hasDoneIt: boolean) => {
    if (!onlineSession || currentOnlinePlayerIndex === null) {
      return
    }
    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.neverHaveI
    if (!game || game.phase !== 'answer' || game.answers[currentOnlinePlayerIndex] !== null) {
      return
    }
    const answers = [...game.answers] as [boolean | null, boolean | null]
    answers[currentOnlinePlayerIndex] = hasDoneIt
    const bothAnswered = answers[0] !== null && answers[1] !== null
    const sharedScore = bothAnswered ? game.sharedScore + (answers[0] === answers[1] ? 2 : 1) : game.sharedScore

    const nextGame: OnlineNeverHaveIState = {
      ...game,
      answers,
      sharedScore,
      phase: bothAnswered ? 'reveal' : 'answer',
      cue: bothAnswered
        ? createCue(
            1,
            answers[0] === answers[1] ? 'Same answer' : 'Different stories',
            answers[0] === answers[1] ? 'You two are in sync.' : 'Still learning new layers.',
            answers[0] === answers[1] ? KISS_HEART : THUMBS_UP,
            answers[0] === answers[1] ? 'success' : 'soft',
          )
        : createCue(currentOnlinePlayerIndex, 'Answer saved', 'Waiting for your partner.', THUMBS_UP, 'soft'),
      statusMessage: bothAnswered ? 'Both answers are in.' : `${onlinePlayerName(currentOnlinePlayerIndex)} answered.`,
    }

    try {
      await syncOnlineRoomState(
        buildOnlineRoomState(
          { ...payload, neverHaveI: nextGame, lastEvent: `${onlinePlayerName(currentOnlinePlayerIndex)} answered the prompt.` },
          'never-have-i-ever',
          nextGame.phase,
          'both',
        ),
        { game_key: 'never-have-i-ever', status: 'playing' },
      )
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not save that answer.')
    }
  }

  const advanceOnlineNeverHaveI = async () => {
    if (!onlineSession) {
      return
    }
    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.neverHaveI
    if (!game) {
      return
    }

    if (game.round >= game.totalRounds) {
      const summary = `You completed ${game.totalRounds} prompts and built a shared score of ${game.sharedScore}.`
      const nextGame: OnlineNeverHaveIState = {
        ...game,
        phase: 'result',
        resultSummary: summary,
        cue: createCue(1, 'That was sweet', 'You kept learning about each other.', KISS_HEART, 'win'),
        statusMessage: summary,
      }
      try {
        await syncOnlineRoomState(
          buildOnlineRoomState({ ...payload, neverHaveI: nextGame, lastEvent: summary }, 'never-have-i-ever', 'result', 'both'),
          { game_key: 'never-have-i-ever', status: 'finished' },
        )
      } catch (error) {
        setOnlineError(error instanceof Error ? error.message : 'Could not finish Never Have I Ever.')
      }
      return
    }

    const nextPromptIndex = game.promptIndex + 1
    const nextGame: OnlineNeverHaveIState = {
      ...game,
      round: game.round + 1,
      promptIndex: nextPromptIndex,
      currentPrompt: NEVER_HAVE_I_PROMPTS[nextPromptIndex % NEVER_HAVE_I_PROMPTS.length],
      answers: [null, null],
      phase: 'intro',
      cue: createCue(1, 'Next one', 'Ready for another reveal?', THUMBS_UP, 'soft'),
      statusMessage: 'Next prompt ready.',
    }
    try {
      await syncOnlineRoomState(
        buildOnlineRoomState({ ...payload, neverHaveI: nextGame, lastEvent: 'Next prompt ready.' }, 'never-have-i-ever', 'intro', 'both'),
        { game_key: 'never-have-i-ever', status: 'playing' },
      )
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not advance the prompt.')
    }
  }

  const startOnlineCelebrityGuess = async () => {
    if (!onlineSession || !canStartOnlineGame(onlineSession, 'celebrity-guess')) {
      return
    }
    const payload: OnlineRoomPayload = {
      ...readOnlinePayload(onlineSession.roomState.payload),
      numberDuel: null,
      wordChain: null,
      raceDash: null,
      ticTacToe: null,
      mineMatrix: null,
      truthOrDare: null,
      neverHaveI: null,
      hangman: null,
      dotsBoxes: null,
      celebrityGuess: createOnlineCelebrityGuess(),
      lastEvent: 'Online Celebrity Guess started.',
    }
    setOnlineBusyAction('start')
    try {
      await syncOnlineRoomState(buildOnlineRoomState(payload, 'celebrity-guess', 'secret', turnForPlayer(0)), {
        game_key: 'celebrity-guess',
        status: 'playing',
      })
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not start Online Celebrity Guess.')
    } finally {
      setOnlineBusyAction(null)
    }
  }

  const chooseOnlineCelebrity = async (celebrity: string) => {
    if (!onlineSession || currentOnlinePlayerIndex === null) {
      return
    }
    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.celebrityGuess
    if (!game || game.phase !== 'secret' || game.chooser !== currentOnlinePlayerIndex) {
      return
    }
    const nextGame: OnlineCelebrityGuessState = {
      ...game,
      phase: 'questions',
      secretCelebrity: celebrity,
      cue: createCue(game.chooser, 'Celebrity locked', 'Start asking clue questions.', KISS_HEART, 'soft'),
      statusMessage: `${onlinePlayerName(game.guesser)} is guessing.`,
    }
    try {
      await syncOnlineRoomState(
        buildOnlineRoomState({ ...payload, celebrityGuess: nextGame, lastEvent: 'Celebrity locked in.' }, 'celebrity-guess', 'questions', turnForPlayer(game.guesser)),
        { game_key: 'celebrity-guess', status: 'playing' },
      )
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not lock the celebrity.')
    }
  }

  const pickOnlineCelebrityQuestion = async (question: string) => {
    if (!onlineSession || currentOnlinePlayerIndex === null) {
      return
    }
    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.celebrityGuess
    if (!game || game.phase !== 'questions' || game.guesser !== currentOnlinePlayerIndex) {
      return
    }
    const nextGame: OnlineCelebrityGuessState = {
      ...game,
      pendingQuestion: question,
      statusMessage: `${onlinePlayerName(game.chooser)} is answering a clue question.`,
    }
    try {
      await syncOnlineRoomState(
        buildOnlineRoomState({ ...payload, celebrityGuess: nextGame, lastEvent: `${onlinePlayerName(game.guesser)} asked a question.` }, 'celebrity-guess', 'questions', turnForPlayer(game.chooser)),
        { game_key: 'celebrity-guess', status: 'playing' },
      )
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not ask that question.')
    }
  }

  const answerOnlineCelebrityQuestion = async (answer: CelebrityAnswer) => {
    if (!onlineSession || currentOnlinePlayerIndex === null) {
      return
    }
    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.celebrityGuess
    if (!game || game.phase !== 'questions' || game.chooser !== currentOnlinePlayerIndex || !game.pendingQuestion) {
      return
    }
    const history = [...game.history, { question: game.pendingQuestion, answer }].slice(-8)
    const nextGame: OnlineCelebrityGuessState = {
      ...game,
      history,
      questionCount: game.questionCount + 1,
      pendingQuestion: null,
      cue: createCue(
        game.chooser,
        answer,
        answer === 'Yes' ? 'That should help.' : answer === 'No' ? 'Cross that path off.' : 'A little in-between.',
        answer === 'Yes' ? KISS_HEART : THUMBS_UP,
        answer === 'Yes' ? 'success' : 'soft',
      ),
      statusMessage: `${onlinePlayerName(game.guesser)} can guess now or ask another question.`,
    }
    try {
      await syncOnlineRoomState(
        buildOnlineRoomState({ ...payload, celebrityGuess: nextGame, lastEvent: `${onlinePlayerName(game.chooser)} answered a clue question.` }, 'celebrity-guess', 'questions', turnForPlayer(game.guesser)),
        { game_key: 'celebrity-guess', status: 'playing' },
      )
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not save that answer.')
    }
  }

  const submitOnlineCelebrityGuess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!onlineSession || currentOnlinePlayerIndex === null) {
      return
    }
    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.celebrityGuess
    if (!game || game.phase !== 'questions' || game.guesser !== currentOnlinePlayerIndex) {
      return
    }
    const normalizedGuess = normalizeText(celebGuessDraft)
    if (!normalizedGuess) {
      return
    }
    const normalizedSecret = normalizeText(game.secretCelebrity)
    if (normalizedGuess === normalizedSecret) {
      const winner = game.guesser
      const summary = `${onlinePlayerName(winner)} guessed ${game.secretCelebrity} correctly.`
      const nextGame: OnlineCelebrityGuessState = {
        ...game,
        phase: 'result',
        winner,
        resultSummary: summary,
        cue: createCue(winner, 'Correct', 'That was a sharp read.', KISS_HEART, 'win'),
        statusMessage: summary,
      }
      try {
        await syncOnlineRoomState(
          buildOnlineRoomState({ ...payload, celebrityGuess: nextGame, lastEvent: summary }, 'celebrity-guess', 'result', 'both'),
          { game_key: 'celebrity-guess', status: 'finished' },
        )
        setCelebGuessDraft('')
      } catch (error) {
        setOnlineError(error instanceof Error ? error.message : 'Could not save that guess.')
      }
      return
    }

    if (game.questionCount >= game.maxQuestions) {
      const winner = game.chooser
      const summary = `${onlinePlayerName(winner)} protected the celebrity identity.`
      const nextGame: OnlineCelebrityGuessState = {
        ...game,
        phase: 'result',
        winner,
        resultSummary: summary,
        cue: createCue(winner, 'Not this time', `The answer was ${game.secretCelebrity}.`, THUMBS_UP, 'warning'),
        statusMessage: summary,
      }
      try {
        await syncOnlineRoomState(
          buildOnlineRoomState({ ...payload, celebrityGuess: nextGame, lastEvent: summary }, 'celebrity-guess', 'result', 'both'),
          { game_key: 'celebrity-guess', status: 'finished' },
        )
        setCelebGuessDraft('')
      } catch (error) {
        setOnlineError(error instanceof Error ? error.message : 'Could not finish Celebrity Guess.')
      }
      return
    }

    try {
      await syncOnlineRoomState(
        buildOnlineRoomState(
          {
            ...payload,
            celebrityGuess: {
              ...game,
              cue: createCue(game.chooser, 'Not quite', 'Ask a few more questions.', THUMBS_UP, 'warning'),
              statusMessage: 'Guess was wrong. Keep narrowing it down.',
            },
            lastEvent: `${onlinePlayerName(game.guesser)} made a wrong guess.`,
          },
          'celebrity-guess',
          'questions',
          turnForPlayer(game.guesser),
        ),
        { game_key: 'celebrity-guess', status: 'playing' },
      )
      setCelebGuessDraft('')
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not keep Celebrity Guess moving.')
    }
  }

  const startOnlineHangman = async () => {
    if (!onlineSession || !canStartOnlineGame(onlineSession, 'hangman')) {
      return
    }
    const payload: OnlineRoomPayload = {
      ...readOnlinePayload(onlineSession.roomState.payload),
      numberDuel: null,
      wordChain: null,
      raceDash: null,
      ticTacToe: null,
      mineMatrix: null,
      truthOrDare: null,
      neverHaveI: null,
      celebrityGuess: null,
      dotsBoxes: null,
      hangman: createOnlineHangman(),
      lastEvent: 'Online Hangman started.',
    }
    setOnlineBusyAction('start')
    try {
      await syncOnlineRoomState(buildOnlineRoomState(payload, 'hangman', 'secret', turnForPlayer(0)), {
        game_key: 'hangman',
        status: 'playing',
      })
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not start Online Hangman.')
    } finally {
      setOnlineBusyAction(null)
    }
  }

  const lockOnlineHangmanWord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!onlineSession || currentOnlinePlayerIndex === null) {
      return
    }
    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.hangman
    if (!game || game.phase !== 'secret' || game.setter !== currentOnlinePlayerIndex) {
      return
    }
    const cleaned = hangmanWordDraft.toUpperCase().replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim()
    if (cleaned.length < 3) {
      return
    }
    const nextGame: OnlineHangmanState = {
      ...game,
      phase: 'guess',
      word: cleaned,
      cue: createCue(game.setter, 'Save me', 'Guess the last word before the rope wins.', THUMBS_UP, 'soft'),
      statusMessage: `${onlinePlayerName(game.guesser)} is guessing now.`,
    }
    try {
      await syncOnlineRoomState(
        buildOnlineRoomState({ ...payload, hangman: nextGame, lastEvent: 'Hangman word locked.' }, 'hangman', 'guess', turnForPlayer(game.guesser)),
        { game_key: 'hangman', status: 'playing' },
      )
      setHangmanWordDraft('')
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not lock the word.')
    }
  }

  const submitOnlineHangmanGuess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!onlineSession || currentOnlinePlayerIndex === null) {
      return
    }
    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.hangman
    if (!game || game.phase !== 'guess' || game.guesser !== currentOnlinePlayerIndex) {
      return
    }
    const letter = hangmanLetterDraft.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1)
    if (!letter) {
      return
    }
    if (game.guessedLetters.includes(letter) || game.wrongLetters.includes(letter)) {
      setHangmanLetterDraft('')
      return
    }
    const wordLetters = [...new Set(game.word.replace(/ /g, '').split(''))]

    const settleOnlineHangmanRound = async (
      roundWinner: PlayerIndex,
      summary: string,
      cue: ReactionCue,
    ) => {
      const scores = [...game.scores] as [number, number]
      scores[roundWinner] += 1

      if (game.round < game.totalRounds) {
        const nextSetter = game.guesser
        const nextGuesser = game.setter
        const nextGame: OnlineHangmanState = {
          ...game,
          phase: 'secret',
          round: game.round + 1,
          setter: nextSetter,
          guesser: nextGuesser,
          scores,
          word: '',
          guessedLetters: [],
          wrongLetters: [],
          winner: null,
          resultSummary: '',
          cue,
          statusMessage: `${summary} Round ${game.round + 1} starts with ${onlinePlayerName(nextSetter)} setting the word.`,
        }

        await syncOnlineRoomState(
          buildOnlineRoomState(
            { ...payload, hangman: nextGame, lastEvent: `${summary} Next round begins.` },
            'hangman',
            'secret',
            turnForPlayer(nextSetter),
          ),
          { game_key: 'hangman', status: 'playing' },
        )
        return
      }

      const finalWinner: SessionWinner = scores[0] === scores[1] ? 'draw' : scores[0] > scores[1] ? 0 : 1
      const nextGame: OnlineHangmanState = {
        ...game,
        phase: 'result',
        scores,
        winner: finalWinner,
        resultSummary:
          finalWinner === 'draw'
            ? `Both rounds are done and Hangman ends tied ${scores[0]}-${scores[1]}.`
            : `${onlinePlayerName(finalWinner as PlayerIndex)} wins Online Hangman ${scores[0]}-${scores[1]}.`,
        cue:
          finalWinner === 'draw'
            ? createCue(0, 'Dead even', 'You split the rescue drama perfectly.', KISS_HEART, 'win')
            : createCue(finalWinner as PlayerIndex, 'Hangman champion', 'You took the better two-round score.', KISS_HEART, 'win'),
        statusMessage:
          finalWinner === 'draw'
            ? `Online Hangman ends tied ${scores[0]}-${scores[1]}.`
            : `${onlinePlayerName(finalWinner as PlayerIndex)} wins Online Hangman.`,
      }

      await syncOnlineRoomState(
        buildOnlineRoomState({ ...payload, hangman: nextGame, lastEvent: nextGame.resultSummary }, 'hangman', 'result', 'both'),
        { game_key: 'hangman', status: 'finished' },
      )
    }

    if (game.word.includes(letter)) {
      const guessedLetters = [...game.guessedLetters, letter]
      const guessedAll = wordLetters.every((value) => guessedLetters.includes(value))
      if (guessedAll) {
        const winner = game.guesser
        const summary = `${onlinePlayerName(winner)} solved "${game.word}".`
        try {
          await settleOnlineHangmanRound(
            winner,
            summary,
            createCue(winner, 'Solved it', 'That final letter was perfect.', KISS_HEART, 'win'),
          )
          setHangmanLetterDraft('')
        } catch (error) {
          setOnlineError(error instanceof Error ? error.message : 'Could not finish Hangman.')
        }
        return
      }
      try {
        await syncOnlineRoomState(
          buildOnlineRoomState(
            {
              ...payload,
              hangman: {
                ...game,
                guessedLetters,
                cue: createCue(game.setter, 'Okay, that helps', 'Keep going, rescue montage mode.', KISS_HEART, 'success'),
                statusMessage: 'Correct letter.',
              },
              lastEvent: `${onlinePlayerName(game.guesser)} found a correct letter.`,
            },
            'hangman',
            'guess',
            turnForPlayer(game.guesser),
          ),
          { game_key: 'hangman', status: 'playing' },
        )
        setHangmanLetterDraft('')
      } catch (error) {
        setOnlineError(error instanceof Error ? error.message : 'Could not save that letter.')
      }
      return
    }
    const wrongLetters = [...game.wrongLetters, letter]
    if (wrongLetters.length >= 6) {
      const winner = game.setter
      const summary = `${onlinePlayerName(winner)} kept "${game.word}" hidden.`
      try {
        await settleOnlineHangmanRound(
          winner,
          summary,
          createCue(winner, 'Too many misses', `The word was ${game.word}.`, THUMBS_UP, 'warning'),
        )
        setHangmanLetterDraft('')
      } catch (error) {
        setOnlineError(error instanceof Error ? error.message : 'Could not finish Hangman.')
      }
      return
    }
    try {
      await syncOnlineRoomState(
        buildOnlineRoomState(
          {
            ...payload,
            hangman: {
              ...game,
              wrongLetters,
              cue: getHangmanMissCue(game.setter, wrongLetters.length),
              statusMessage: 'Wrong letter. Keep trying.',
            },
            lastEvent: `${onlinePlayerName(game.guesser)} missed a letter.`,
          },
          'hangman',
          'guess',
          turnForPlayer(game.guesser),
        ),
        { game_key: 'hangman', status: 'playing' },
      )
      setHangmanLetterDraft('')
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not save that miss.')
    }
  }

  const startOnlineDotsBoxes = async () => {
    if (!onlineSession || !canStartOnlineGame(onlineSession, 'dots-boxes')) {
      return
    }
    const payload: OnlineRoomPayload = {
      ...readOnlinePayload(onlineSession.roomState.payload),
      numberDuel: null,
      wordChain: null,
      raceDash: null,
      ticTacToe: null,
      mineMatrix: null,
      truthOrDare: null,
      neverHaveI: null,
      celebrityGuess: null,
      hangman: null,
      dotsBoxes: createOnlineDotsBoxes(),
      lastEvent: 'Online Dots and Boxes started.',
    }
    setOnlineBusyAction('start')
    try {
      await syncOnlineRoomState(buildOnlineRoomState(payload, 'dots-boxes', 'play', turnForPlayer(0)), {
        game_key: 'dots-boxes',
        status: 'playing',
      })
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not start Online Dots and Boxes.')
    } finally {
      setOnlineBusyAction(null)
    }
  }

  const playOnlineDotsLine = async (key: string) => {
    if (!onlineSession || currentOnlinePlayerIndex === null) {
      return
    }
    const payload = readOnlinePayload(onlineSession.roomState.payload)
    const game = payload.dotsBoxes
    if (!game || game.phase !== 'play' || key in game.lines || game.currentTurn !== currentOnlinePlayerIndex) {
      return
    }
    const lines = { ...game.lines, [key]: currentOnlinePlayerIndex }
    const boxes = [...game.boxes]
    const scores = [...game.scores] as [number, number]
    const completedBoxes = getAffectedBoxesForLine(key).filter(
      (boxIndex) => boxes[boxIndex] === null && isBoxComplete(lines, boxIndex),
    )

    if (completedBoxes.length > 0) {
      for (const boxIndex of completedBoxes) {
        boxes[boxIndex] = currentOnlinePlayerIndex
      }
      scores[currentOnlinePlayerIndex] += completedBoxes.length
      if (boxes.every((box) => box !== null)) {
        const winner: SessionWinner = scores[0] === scores[1] ? 'draw' : scores[0] > scores[1] ? 0 : 1
        const summary =
          winner === 'draw'
            ? `Online Dots and Boxes ended tied at ${scores[0]}-${scores[1]}.`
            : `${onlinePlayerName(winner as PlayerIndex)} won Online Dots and Boxes ${scores[0]}-${scores[1]}.`
        const nextGame: OnlineDotsBoxesState = {
          ...game,
          lines,
          boxes,
          scores,
          phase: 'result',
          winner,
          resultSummary: summary,
          cue: createCue(currentOnlinePlayerIndex, winner === 'draw' ? 'Final box claimed' : 'Board complete', 'That finished the board.', KISS_HEART, 'win'),
          statusMessage: summary,
        }
        try {
          await syncOnlineRoomState(
            buildOnlineRoomState({ ...payload, dotsBoxes: nextGame, lastEvent: summary }, 'dots-boxes', 'result', 'both'),
            { game_key: 'dots-boxes', status: 'finished' },
          )
        } catch (error) {
          setOnlineError(error instanceof Error ? error.message : 'Could not finish Dots and Boxes.')
        }
        return
      }
      const nextGame: OnlineDotsBoxesState = {
        ...game,
        lines,
        boxes,
        scores,
        cue: createCue(currentOnlinePlayerIndex, completedBoxes.length > 1 ? 'Double box' : 'Box claimed', 'You keep the turn.', KISS_HEART, 'success'),
        statusMessage: `${onlinePlayerName(currentOnlinePlayerIndex)} keeps the turn.`,
      }
      try {
        await syncOnlineRoomState(
          buildOnlineRoomState({ ...payload, dotsBoxes: nextGame, lastEvent: `${onlinePlayerName(currentOnlinePlayerIndex)} claimed a box.` }, 'dots-boxes', 'play', turnForPlayer(currentOnlinePlayerIndex)),
          { game_key: 'dots-boxes', status: 'playing' },
        )
      } catch (error) {
        setOnlineError(error instanceof Error ? error.message : 'Could not save that line.')
      }
      return
    }

    const nextTurn = partnerOf(currentOnlinePlayerIndex)
    const nextGame: OnlineDotsBoxesState = {
      ...game,
      lines,
      boxes,
      scores,
      currentTurn: nextTurn,
      cue: createCue(nextTurn, 'Line added', `${onlinePlayerName(nextTurn)} is up.`, THUMBS_UP, 'soft'),
      statusMessage: `${onlinePlayerName(nextTurn)} is up next.`,
    }
    try {
      await syncOnlineRoomState(
        buildOnlineRoomState({ ...payload, dotsBoxes: nextGame, lastEvent: `${onlinePlayerName(currentOnlinePlayerIndex)} drew a line.` }, 'dots-boxes', 'play', turnForPlayer(nextTurn)),
        { game_key: 'dots-boxes', status: 'playing' },
      )
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not save that line.')
    }
  }

  const savePlayers = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const names: [string, string] = [setupNames[0].trim(), setupNames[1].trim()]
    if (!names[0] || !names[1]) {
      return
    }

    setProfile((current) => ({
      ...current,
      players: names,
      playerColors: setupColors,
    }))
    setScreen('home')
  }

  const startNumberDuel = () => {
    setNumberDuel(createNumberDuel())
    setSecretDraft('')
    setGuessDraft('')
    setScreen('number-duel')
  }

  const moveFromNumberPass = () => {
    if (!numberDuel) {
      return
    }

    setNumberDuel({
      ...numberDuel,
      view: numberDuel.nextView,
      statusMessage:
        numberDuel.nextView === 'guess'
          ? `${currentPlayerName(numberDuel.currentPlayer)}, your range is ready.`
          : '',
    })
    setSecretDraft('')
    setGuessDraft('')
  }

  const moveFromNumberReveal = () => {
    if (!numberDuel) {
      return
    }

    const nextPlayer = partnerOf(numberDuel.currentPlayer)
    setNumberDuel({
      ...numberDuel,
      view: 'guess',
      currentPlayer: nextPlayer,
      statusMessage: `${currentPlayerName(nextPlayer)}, your range is ready.`,
      cue: null,
    })
    setGuessDraft('')
  }

  const lockSecretNumber = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!numberDuel) {
      return
    }

    const parsedSecret = Number(secretDraft)
    if (!Number.isInteger(parsedSecret) || parsedSecret < 1 || parsedSecret > 999) {
      return
    }

    const secrets = [...numberDuel.secrets] as [number | null, number | null]
    secrets[numberDuel.currentPlayer] = parsedSecret

    if (numberDuel.currentPlayer === 0) {
      setNumberDuel({
        ...numberDuel,
        secrets,
        currentPlayer: 1,
        view: 'pass',
        passTitle: `Pass to ${currentPlayerName(1)}`,
        passNote: `${currentPlayerName(0)} locked in a secret number. Time for the second setup.`,
        nextView: 'secret',
      })
      setSecretDraft('')
      return
    }

    setNumberDuel({
      ...numberDuel,
      secrets,
      trackers: [createTracker(secrets[1] as number), createTracker(secrets[0] as number)],
      currentPlayer: 0,
      view: 'pass',
      passTitle: `Pass to ${currentPlayerName(0)}`,
      passNote: 'Both numbers are hidden. Let the narrowing begin.',
      nextView: 'guess',
    })
    setSecretDraft('')
  }

  const submitNumberGuess = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!numberDuel) {
      return
    }

    const tracker = numberDuel.trackers[numberDuel.currentPlayer]
    if (!tracker) {
      return
    }

    const parsedGuess = Number(guessDraft)
    if (
      !Number.isInteger(parsedGuess) ||
      parsedGuess < tracker.min ||
      parsedGuess > tracker.max
    ) {
      return
    }

    const trackers = [...numberDuel.trackers] as [GuessTracker, GuessTracker]
    const updatedTracker: GuessTracker = {
      ...tracker,
      attempts: tracker.attempts + 1,
      recentHints: tracker.recentHints,
    }

    if (parsedGuess === tracker.target) {
      const winner = numberDuel.currentPlayer
      const loser = partnerOf(winner)
      const pointsEarned = Math.max(10, 18 - updatedTracker.attempts)
      const newlyUnlocked = applyMatchResult(
        'Number Duel',
        currentPlayerName(winner),
        pointsEarned,
        `${currentPlayerName(winner)} cracked ${currentPlayerName(loser)}'s secret number.`,
      )

      updatedTracker.recentHints = [
        `${currentPlayerName(winner)} guessed ${parsedGuess} exactly in ${updatedTracker.attempts} tries.`,
        ...tracker.recentHints,
      ].slice(0, 4)
      trackers[winner] = updatedTracker

      setNumberDuel({
        ...numberDuel,
        trackers,
        view: 'result',
        winner,
        statusMessage:
          newlyUnlocked > 0
            ? `${currentPlayerName(winner)} wins and unlocks ${newlyUnlocked} new reward${newlyUnlocked > 1 ? 's' : ''}.`
            : `${currentPlayerName(winner)} wins and earns ${pointsEarned} bond points.`,
        cue: createCue(winner, 'Exactly right', 'That was a beautiful read.', KISS_HEART, 'win'),
      })
      setGuessDraft('')
      return
    }

    const clue = parsedGuess < tracker.target ? 'Higher' : 'Lower'
    const previousRangeSize = tracker.max - tracker.min + 1
    updatedTracker.min =
      parsedGuess < tracker.target ? Math.max(tracker.min, parsedGuess + 1) : tracker.min
    updatedTracker.max =
      parsedGuess > tracker.target ? Math.min(tracker.max, parsedGuess - 1) : tracker.max
    const nextRangeSize = updatedTracker.max - updatedTracker.min + 1
    const isBigCut = nextRangeSize <= previousRangeSize / 2

    updatedTracker.recentHints = [
      `${currentPlayerName(numberDuel.currentPlayer)} guessed ${parsedGuess}. ${clue}.`,
      ...tracker.recentHints,
    ].slice(0, 4)
    trackers[numberDuel.currentPlayer] = updatedTracker

    const speaker = partnerOf(numberDuel.currentPlayer)
    setNumberDuel({
      ...numberDuel,
      trackers,
      view: 'reveal',
      cue: createCue(
        speaker,
        clue,
        isBigCut ? 'Good job' : 'Keep it up',
        isBigCut ? KISS_HEART : THUMBS_UP,
        clue === 'Higher' ? 'higher' : 'lower',
      ),
      statusMessage: '',
    })
    setGuessDraft('')
  }

  const startMineMatrix = () => {
    setMineMatrix(createMineMatrix())
    setScreen('mine-matrix')
  }

  const toggleMineSelection = (cell: number) => {
    if (!mineMatrix || mineMatrix.view !== 'plant') {
      return
    }

    const selections = [...mineMatrix.plantingSelections] as [number[], number[]]
    const currentSelections = selections[mineMatrix.currentPlayer]
    if (includesCell(currentSelections, cell)) {
      selections[mineMatrix.currentPlayer] = currentSelections.filter((value) => value !== cell)
    } else if (currentSelections.length < 3) {
      selections[mineMatrix.currentPlayer] = [...currentSelections, cell]
    } else {
      return
    }

    setMineMatrix({
      ...mineMatrix,
      plantingSelections: selections,
    })
  }

  const confirmMinePlacement = () => {
    if (!mineMatrix || mineMatrix.view !== 'plant') {
      return
    }

    const currentSelections = mineMatrix.plantingSelections[mineMatrix.currentPlayer]
    if (currentSelections.length !== 3) {
      return
    }

    if (mineMatrix.currentPlayer === 0) {
      setMineMatrix({
        ...mineMatrix,
        view: 'pass',
        currentPlayer: 1,
        passTitle: `Pass to ${currentPlayerName(1)}`,
        passNote: `${currentPlayerName(0)} planted three hidden mines.`,
        nextView: 'plant',
        cue: createCue(0, 'Board locked', 'Now let your partner hide theirs.', THUMBS_UP, 'soft'),
      })
      return
    }

    setMineMatrix({
      ...mineMatrix,
      mineBoards: [
        [...mineMatrix.plantingSelections[0]],
        [...mineMatrix.plantingSelections[1]],
      ],
      currentPlayer: 0,
      view: 'pass',
      passTitle: `Pass to ${currentPlayerName(0)}`,
      passNote: 'Both trays are ready. Try not to bite into a mine.',
      nextView: 'play',
      cue: createCue(1, 'Everything is hidden', 'Pick carefully.', KISS_HEART, 'soft'),
    })
  }

  const moveFromMinePass = () => {
    if (!mineMatrix) {
      return
    }

    setMineMatrix({
      ...mineMatrix,
      view: mineMatrix.nextView,
      statusMessage:
        mineMatrix.nextView === 'play'
          ? `${currentPlayerName(mineMatrix.currentPlayer)}, pick one spot.`
          : '',
      cue:
        mineMatrix.nextView === 'play'
          ? createCue(
              partnerOf(mineMatrix.currentPlayer),
              'Pick carefully',
              'Three strikes and you lose.',
              THUMBS_UP,
              'soft',
            )
          : mineMatrix.cue,
    })
  }

  const revealMineCell = (cell: number) => {
    if (!mineMatrix || mineMatrix.view !== 'play') {
      return
    }

    const attacker = mineMatrix.currentPlayer
    const defender = partnerOf(attacker)
    if (includesCell(mineMatrix.revealedBoards[defender], cell)) {
      return
    }

    const revealedBoards = [...mineMatrix.revealedBoards] as [number[], number[]]
    revealedBoards[defender] = [...revealedBoards[defender], cell]

    const mineHits = [...mineMatrix.mineHits] as [number, number]
    const hitMine = includesCell(mineMatrix.mineBoards[defender], cell)

    if (hitMine) {
      mineHits[attacker] += 1
    }

    if (hitMine && mineHits[attacker] >= 3) {
      const winner = defender
      const loser = attacker
      const newlyUnlocked = applyMatchResult(
        'Mine Matrix',
        currentPlayerName(winner),
        16,
        `${currentPlayerName(winner)} stayed safer while ${currentPlayerName(loser)} hit three mines.`,
      )

      setMineMatrix({
        ...mineMatrix,
        revealedBoards,
        mineHits,
        view: 'result',
        winner,
        statusMessage:
          newlyUnlocked > 0
            ? `${currentPlayerName(winner)} wins and unlocks ${newlyUnlocked} new reward${newlyUnlocked > 1 ? 's' : ''}.`
            : `${currentPlayerName(winner)} wins the Mine Matrix round.`,
        cue: createCue(winner, 'That was the final strike', 'Safe and steady wins this one.', KISS_HEART, 'win'),
      })
      return
    }

    const nextPlayer = defender
    setMineMatrix({
      ...mineMatrix,
      revealedBoards,
      mineHits,
      currentPlayer: nextPlayer,
      view: 'pass',
      passTitle: `Pass to ${currentPlayerName(nextPlayer)}`,
      passNote: hitMine
        ? `${currentPlayerName(attacker)} hit a mine and now has ${mineHits[attacker]} strike${mineHits[attacker] === 1 ? '' : 's'}.`
        : `${currentPlayerName(attacker)} found a safe bite.`,
      nextView: 'play',
      statusMessage: '',
      cue: createCue(
        defender,
        hitMine ? 'Boom' : 'Safe',
        hitMine ? 'That one stung a little.' : 'Nice dodge.',
        hitMine ? MINE_ICON : KISS_HEART,
        hitMine ? 'warning' : 'success',
      ),
    })
  }

  const startTruthOrDare = () => {
    setTruthOrDare(createTruthOrDare())
    setScreen('truth-dare')
  }

  const drawTruthOrDareCard = (kind: TruthKind) => {
    if (!truthOrDare || truthOrDare.view !== 'choose') {
      return
    }

    const prompt =
      kind === 'Truth'
        ? TRUTH_PROMPTS[truthOrDare.truthIndex % TRUTH_PROMPTS.length]
        : DARE_PROMPTS[truthOrDare.dareIndex % DARE_PROMPTS.length]

    setTruthOrDare({
      ...truthOrDare,
      view: 'card',
      activeCard: { kind, prompt },
      truthIndex: kind === 'Truth' ? truthOrDare.truthIndex + 1 : truthOrDare.truthIndex,
      dareIndex: kind === 'Dare' ? truthOrDare.dareIndex + 1 : truthOrDare.dareIndex,
      cue: createCue(
        partnerOf(truthOrDare.currentPlayer),
        kind === 'Truth' ? 'Tell me the truth' : 'I dare you',
        'You\'ve got this.',
        KISS_HEART,
        kind === 'Truth' ? 'truth' : 'dare',
      ),
    })
  }

  const redrawTruthOrDareCard = () => {
    if (!truthOrDare || truthOrDare.view !== 'card' || !truthOrDare.activeCard) {
      return
    }

    const kind = truthOrDare.activeCard.kind
    const prompt =
      kind === 'Truth'
        ? TRUTH_PROMPTS[truthOrDare.truthIndex % TRUTH_PROMPTS.length]
        : DARE_PROMPTS[truthOrDare.dareIndex % DARE_PROMPTS.length]

    setTruthOrDare({
      ...truthOrDare,
      activeCard: { kind, prompt },
      truthIndex: kind === 'Truth' ? truthOrDare.truthIndex + 1 : truthOrDare.truthIndex,
      dareIndex: kind === 'Dare' ? truthOrDare.dareIndex + 1 : truthOrDare.dareIndex,
    })
  }

  const completeTruthOrDareCard = () => {
    if (!truthOrDare || truthOrDare.view !== 'card') {
      return
    }

    const scores = [...truthOrDare.scores] as [number, number]
    scores[truthOrDare.currentPlayer] += 1
    const isLastRound = truthOrDare.round >= truthOrDare.totalRounds

    if (isLastRound) {
      const winner: SessionWinner =
        scores[0] === scores[1] ? 'both' : scores[0] > scores[1] ? 0 : 1
      const summary =
        winner === 'both'
          ? 'Both of you finished the Truth or Dare session tied and smiling.'
          : `${currentPlayerName(winner)} won the Truth or Dare session ${scores[0]}-${scores[1]}.`
      const points = 10 + scores[0] + scores[1]
      const newlyUnlocked = applyMatchResult(
        'Truth or Dare',
        winner === 'both' ? 'Both of you' : currentPlayerName(winner),
        points,
        summary,
      )

      setTruthOrDare({
        ...truthOrDare,
        scores,
        view: 'result',
        winner,
        resultSummary:
          newlyUnlocked > 0
            ? `${summary} You also unlocked ${newlyUnlocked} new reward${newlyUnlocked > 1 ? 's' : ''}.`
            : `${summary} You earned ${points} bond points together.`,
        cue: createCue(
          truthOrDare.currentPlayer,
          'Round complete',
          'That was fun.',
          KISS_HEART,
          'win',
        ),
      })
      return
    }

    const nextPlayer = partnerOf(truthOrDare.currentPlayer)
    setTruthOrDare({
      ...truthOrDare,
      scores,
      currentPlayer: nextPlayer,
      round: truthOrDare.round + 1,
      view: 'pass',
      passTitle: `Pass to ${currentPlayerName(nextPlayer)}`,
      passNote: `${currentPlayerName(
        truthOrDare.currentPlayer,
      )} finished a ${truthOrDare.activeCard?.kind.toLowerCase()} card.`,
      nextView: 'choose',
      activeCard: null,
      cue: createCue(
        truthOrDare.currentPlayer,
        'Good job',
        'Your partner is up next.',
        THUMBS_UP,
        'success',
      ),
    })
  }

  const moveFromTruthPass = () => {
    if (!truthOrDare) {
      return
    }

    setTruthOrDare({
      ...truthOrDare,
      view: truthOrDare.nextView,
      cue: createCue(
        partnerOf(truthOrDare.currentPlayer),
        'Choose your card',
        'Truth or Dare?',
        KISS_HEART,
        'soft',
      ),
    })
  }

  const startNeverHaveI = () => {
    setNeverHaveI(createNeverHaveI())
    setScreen('never-have-i-ever')
  }

  const beginNeverHaveIRound = () => {
    if (!neverHaveI || neverHaveI.view !== 'intro') {
      return
    }

    setNeverHaveI({
      ...neverHaveI,
      view: 'answer',
      currentPlayer: 0,
      cue: createCue(1, 'Answer honestly', 'Your answer stays hidden until reveal.', THUMBS_UP, 'soft'),
    })
  }

  const answerNeverHaveI = (hasDoneIt: boolean) => {
    if (!neverHaveI || neverHaveI.view !== 'answer') {
      return
    }

    const answers = [...neverHaveI.answers] as [boolean | null, boolean | null]
    answers[neverHaveI.currentPlayer] = hasDoneIt

    if (neverHaveI.currentPlayer === 0) {
      setNeverHaveI({
        ...neverHaveI,
        answers,
        currentPlayer: 1,
        view: 'pass',
        passTitle: `Pass to ${currentPlayerName(1)}`,
        passNote: `${currentPlayerName(0)} locked in an answer.`,
        cue: createCue(0, 'Answer saved', 'Now let your partner answer.', THUMBS_UP, 'soft'),
      })
      return
    }

    const sameAnswer = answers[0] === answers[1]
    const sharedScore = neverHaveI.sharedScore + (sameAnswer ? 2 : 1)

    setNeverHaveI({
      ...neverHaveI,
      answers,
      sharedScore,
      view: 'reveal',
      cue: createCue(
        1,
        sameAnswer ? 'Same answer' : 'Different stories',
        sameAnswer ? 'You two are in sync.' : 'Still learning new layers.',
        sameAnswer ? KISS_HEART : THUMBS_UP,
        sameAnswer ? 'success' : 'soft',
      ),
    })
  }

  const moveFromNeverHaveIPass = () => {
    if (!neverHaveI) {
      return
    }

    setNeverHaveI({
      ...neverHaveI,
      view: 'answer',
      cue: createCue(0, 'Your turn', 'Keep your answer hidden.', THUMBS_UP, 'soft'),
    })
  }

  const advanceNeverHaveI = () => {
    if (!neverHaveI) {
      return
    }

    if (neverHaveI.round >= neverHaveI.totalRounds) {
      const points = 12 + neverHaveI.sharedScore * 2
      const summary = `You completed ${neverHaveI.totalRounds} Never Have I Ever prompts and built a shared score of ${neverHaveI.sharedScore}.`
      const newlyUnlocked = applyMatchResult(
        'Never Have I Ever',
        'Both of you',
        points,
        summary,
      )

      setNeverHaveI({
        ...neverHaveI,
        view: 'result',
        resultSummary:
          newlyUnlocked > 0
            ? `${summary} You also unlocked ${newlyUnlocked} new reward${newlyUnlocked > 1 ? 's' : ''}.`
            : `${summary} You earned ${points} bond points together.`,
        cue: createCue(1, 'That was sweet', 'You kept learning about each other.', KISS_HEART, 'win'),
      })
      return
    }

    const nextPromptIndex = neverHaveI.promptIndex + 1
    setNeverHaveI({
      ...neverHaveI,
      round: neverHaveI.round + 1,
      promptIndex: nextPromptIndex,
      currentPrompt: NEVER_HAVE_I_PROMPTS[nextPromptIndex % NEVER_HAVE_I_PROMPTS.length],
      currentPlayer: 0,
      answers: [null, null],
      view: 'intro',
      cue: createCue(1, 'Next one', 'Ready for another reveal?', THUMBS_UP, 'soft'),
    })
  }

  const startCelebrityGuess = () => {
    setCelebrityGuess(createCelebrityGuess())
    setCelebGuessDraft('')
    setScreen('celebrity-guess')
  }

  const chooseSecretCelebrity = (celebrity: string) => {
    if (!celebrityGuess || celebrityGuess.view !== 'secret') {
      return
    }

    setCelebrityGuess({
      ...celebrityGuess,
      secretCelebrity: celebrity,
      view: 'pass',
      passTitle: `Pass to ${currentPlayerName(celebrityGuess.guesser)}`,
      passNote: `${currentPlayerName(celebrityGuess.chooser)} picked the celebrity. Time to start asking questions.`,
      cue: createCue(
        celebrityGuess.chooser,
        'Celebrity locked',
        'Let them start narrowing it down.',
        KISS_HEART,
        'soft',
      ),
    })
  }

  const moveFromCelebrityPass = () => {
    if (!celebrityGuess) {
      return
    }

    setCelebrityGuess({
      ...celebrityGuess,
      view: 'questions',
      cue: createCue(
        celebrityGuess.chooser,
        'Ask away',
        'I\'ll answer honestly.',
        THUMBS_UP,
        'soft',
      ),
    })
  }

  const pickCelebrityQuestion = (question: string) => {
    if (!celebrityGuess || celebrityGuess.view !== 'questions') {
      return
    }

    setCelebrityGuess({
      ...celebrityGuess,
      pendingQuestion: question,
    })
  }

  const answerCelebrityQuestion = (answer: CelebrityAnswer) => {
    if (
      !celebrityGuess ||
      celebrityGuess.view !== 'questions' ||
      !celebrityGuess.pendingQuestion
    ) {
      return
    }

    const history = [
      ...celebrityGuess.history,
      { question: celebrityGuess.pendingQuestion, answer },
    ].slice(-8)

    setCelebrityGuess({
      ...celebrityGuess,
      history,
      questionCount: celebrityGuess.questionCount + 1,
      pendingQuestion: null,
      cue: createCue(
        celebrityGuess.chooser,
        answer,
        answer === 'Yes'
          ? 'That should help.'
          : answer === 'No'
            ? 'Cross that path off.'
            : 'A little in-between.',
        answer === 'Yes' ? KISS_HEART : THUMBS_UP,
        answer === 'Yes' ? 'success' : 'soft',
      ),
    })
  }

  const submitCelebrityGuess = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!celebrityGuess || celebrityGuess.view !== 'questions') {
      return
    }

    const normalizedGuess = normalizeText(celebGuessDraft)
    if (!normalizedGuess) {
      return
    }

    const normalizedSecret = normalizeText(celebrityGuess.secretCelebrity)
    if (normalizedGuess === normalizedSecret) {
      const winner = celebrityGuess.guesser
      const newlyUnlocked = applyMatchResult(
        'Celebrity Guess',
        currentPlayerName(winner),
        18,
        `${currentPlayerName(winner)} guessed ${celebrityGuess.secretCelebrity} correctly.`,
      )

      setCelebrityGuess({
        ...celebrityGuess,
        view: 'result',
        winner,
        resultSummary:
          newlyUnlocked > 0
            ? `${currentPlayerName(winner)} guessed ${celebrityGuess.secretCelebrity} correctly and unlocked ${newlyUnlocked} new reward${newlyUnlocked > 1 ? 's' : ''}.`
            : `${currentPlayerName(winner)} guessed ${celebrityGuess.secretCelebrity} correctly and earned 18 bond points.`,
        cue: createCue(winner, 'Correct', 'That was a sharp read.', KISS_HEART, 'win'),
      })
      setCelebGuessDraft('')
      return
    }

    if (celebrityGuess.questionCount >= celebrityGuess.maxQuestions) {
      const winner = celebrityGuess.chooser
      const newlyUnlocked = applyMatchResult(
        'Celebrity Guess',
        currentPlayerName(winner),
        14,
        `${currentPlayerName(winner)} protected the celebrity identity until the final wrong guess.`,
      )

      setCelebrityGuess({
        ...celebrityGuess,
        view: 'result',
        winner,
        resultSummary:
          newlyUnlocked > 0
            ? `${currentPlayerName(winner)} held the secret and unlocked ${newlyUnlocked} new reward${newlyUnlocked > 1 ? 's' : ''}.`
            : `${currentPlayerName(winner)} held the secret and earned 14 bond points.`,
        cue: createCue(winner, 'Not this time', `The answer was ${celebrityGuess.secretCelebrity}.`, THUMBS_UP, 'warning'),
      })
      setCelebGuessDraft('')
      return
    }

    setCelebrityGuess({
      ...celebrityGuess,
      cue: createCue(
        celebrityGuess.chooser,
        'Not quite',
        'Ask a few more questions.',
        THUMBS_UP,
        'warning',
      ),
    })
    setCelebGuessDraft('')
  }

  const startHangman = () => {
    setHangman(createHangman())
    setHangmanWordDraft('')
    setHangmanLetterDraft('')
    setScreen('hangman')
  }

  const getHangmanMissCue = (setter: PlayerIndex, missCount: number) => {
    const line = HANGMAN_MISS_LINES[Math.min(missCount - 1, HANGMAN_MISS_LINES.length - 1)]

    return createCue(setter, line.message, line.support, THUMBS_UP, 'warning')
  }

  const lockHangmanWord = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!hangman) {
      return
    }

    const cleaned = hangmanWordDraft.toUpperCase().replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim()
    if (cleaned.length < 3) {
      return
    }

      setHangman({
        ...hangman,
        word: cleaned,
        view: 'pass',
        passTitle: `Pass to ${currentPlayerName(hangman.guesser)}`,
        passNote: `${currentPlayerName(hangman.setter)} locked the secret word.`,
        cue: createCue(hangman.setter, 'Word locked', 'Guess it fast and save me.', THUMBS_UP, 'soft'),
      })
    setHangmanWordDraft('')
  }

  const moveFromHangmanPass = () => {
    if (!hangman) {
      return
    }

      setHangman({
        ...hangman,
        view: 'guess',
        cue: createCue(
          hangman.setter,
          'Save me',
          'Guess the last word before the rope wins.',
          THUMBS_UP,
          'soft',
        ),
    })
  }

  const submitHangmanGuess = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!hangman || hangman.view !== 'guess') {
      return
    }

    const letter = hangmanLetterDraft.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1)
    if (!letter) {
      return
    }

    if (hangman.guessedLetters.includes(letter) || hangman.wrongLetters.includes(letter)) {
      setHangmanLetterDraft('')
      return
    }

    const wordLetters = [...new Set(hangman.word.replace(/ /g, '').split(''))]
    if (hangman.word.includes(letter)) {
      const guessedLetters = [...hangman.guessedLetters, letter]
      const guessedAll = wordLetters.every((value) => guessedLetters.includes(value))

      if (guessedAll) {
        const winner = hangman.guesser
        const newlyUnlocked = applyMatchResult(
          'Hangman',
          currentPlayerName(winner),
          16,
          `${currentPlayerName(winner)} uncovered the word "${hangman.word}".`,
        )

        setHangman({
          ...hangman,
          guessedLetters,
          view: 'result',
          winner,
          resultSummary:
            newlyUnlocked > 0
              ? `${currentPlayerName(winner)} solved "${hangman.word}" and unlocked ${newlyUnlocked} new reward${newlyUnlocked > 1 ? 's' : ''}.`
              : `${currentPlayerName(winner)} solved "${hangman.word}" and earned 16 bond points.`,
          cue: createCue(winner, 'Solved it', 'That final letter was perfect.', KISS_HEART, 'win'),
        })
        setHangmanLetterDraft('')
        return
      }

      setHangman({
        ...hangman,
        guessedLetters,
        cue: createCue(
          hangman.setter,
          'Okay, that helps',
          'Keep going, I can feel the rescue montage starting.',
          KISS_HEART,
          'success',
        ),
      })
      setHangmanLetterDraft('')
      return
    }

    const wrongLetters = [...hangman.wrongLetters, letter]
    if (wrongLetters.length >= 6) {
      const winner = hangman.setter
      const newlyUnlocked = applyMatchResult(
        'Hangman',
        currentPlayerName(winner),
        12,
        `${currentPlayerName(winner)} protected the word "${hangman.word}" through six misses.`,
      )

      setHangman({
        ...hangman,
        wrongLetters,
        view: 'result',
        winner,
        resultSummary:
          newlyUnlocked > 0
            ? `${currentPlayerName(winner)} kept "${hangman.word}" hidden and unlocked ${newlyUnlocked} new reward${newlyUnlocked > 1 ? 's' : ''}.`
            : `${currentPlayerName(winner)} kept "${hangman.word}" hidden and earned 12 bond points.`,
        cue: createCue(winner, 'Too many misses', `The word was ${hangman.word}.`, THUMBS_UP, 'warning'),
      })
      setHangmanLetterDraft('')
      return
    }

    setHangman({
      ...hangman,
      wrongLetters,
      cue: getHangmanMissCue(hangman.setter, wrongLetters.length),
    })
    setHangmanLetterDraft('')
  }

  const startTicTacToe = () => {
    setTicTacToe(createTicTacToe())
    setScreen('tic-tac-toe')
  }

  const playTicTacToeMove = (cell: number) => {
    if (!ticTacToe || ticTacToe.view !== 'play' || ticTacToe.board[cell] !== null) {
      return
    }

    const board = [...ticTacToe.board]
    board[cell] = ticTacToe.currentPlayer
    const winner = getTicWinner(board)

    if (winner !== null) {
      const newlyUnlocked = applyMatchResult(
        'Tic Tac Toe',
        currentPlayerName(winner),
        10,
        `${currentPlayerName(winner)} connected three in a row.`,
      )

      setTicTacToe({
        ...ticTacToe,
        board,
        view: 'result',
        winner,
        resultSummary:
          newlyUnlocked > 0
            ? `${currentPlayerName(winner)} won and unlocked ${newlyUnlocked} new reward${newlyUnlocked > 1 ? 's' : ''}.`
            : `${currentPlayerName(winner)} won and earned 10 bond points.`,
        cue: createCue(winner, 'Three in a row', 'Classic and clean.', KISS_HEART, 'win'),
      })
      return
    }

    if (board.every((value) => value !== null)) {
      const newlyUnlocked = applyMatchResult(
        'Tic Tac Toe',
        'Both of you',
        6,
        'Tic Tac Toe ended in a draw, so you both shared the bond points.',
      )

      setTicTacToe({
        ...ticTacToe,
        board,
        view: 'result',
        winner: 'draw',
        resultSummary:
          newlyUnlocked > 0
            ? `A draw still counts. You unlocked ${newlyUnlocked} new reward${newlyUnlocked > 1 ? 's' : ''}.`
            : 'A draw still counts. You earned 6 shared bond points.',
        cue: createCue(0, 'Draw game', 'That board was tight.', THUMBS_UP, 'soft'),
      })
      return
    }

    const nextPlayer = partnerOf(ticTacToe.currentPlayer)
    const message =
      cell === 4 ? 'Strong center move' : cell % 2 === 0 ? 'Nice corner' : 'Smart line'

    setTicTacToe({
      ...ticTacToe,
      board,
      currentPlayer: nextPlayer,
      cue: createCue(
        nextPlayer,
        message,
        `${currentPlayerName(nextPlayer)}, your turn.`,
        THUMBS_UP,
        'success',
      ),
    })
  }

  const startDotsBoxes = () => {
    setDotsBoxes(createDotsBoxes())
    setScreen('dots-boxes')
  }

  const playDotsLine = (key: string) => {
    if (!dotsBoxes || dotsBoxes.view !== 'play' || key in dotsBoxes.lines) {
      return
    }

    const lines = { ...dotsBoxes.lines, [key]: dotsBoxes.currentPlayer }
    const boxes = [...dotsBoxes.boxes]
    const scores = [...dotsBoxes.scores] as [number, number]
    const completedBoxes = getAffectedBoxesForLine(key).filter(
      (boxIndex) => boxes[boxIndex] === null && isBoxComplete(lines, boxIndex),
    )

    if (completedBoxes.length > 0) {
      for (const boxIndex of completedBoxes) {
        boxes[boxIndex] = dotsBoxes.currentPlayer
      }
      scores[dotsBoxes.currentPlayer] += completedBoxes.length

      if (boxes.every((box) => box !== null)) {
        const winner: SessionWinner =
          scores[0] === scores[1] ? 'draw' : scores[0] > scores[1] ? 0 : 1
        const points = 14 + scores[0] + scores[1]
        const winnerLabel =
          winner === 'draw' ? 'Both of you' : currentPlayerName(winner as PlayerIndex)
        const summary =
          winner === 'draw'
            ? `Dots and Boxes ended tied at ${scores[0]}-${scores[1]}.`
            : `${winnerLabel} won Dots and Boxes ${scores[0]}-${scores[1]}.`
        const newlyUnlocked = applyMatchResult('Dots and Boxes', winnerLabel, points, summary)

        setDotsBoxes({
          ...dotsBoxes,
          lines,
          boxes,
          scores,
          view: 'result',
          winner,
          resultSummary:
            newlyUnlocked > 0
              ? `${summary} You unlocked ${newlyUnlocked} new reward${newlyUnlocked > 1 ? 's' : ''}.`
              : `${summary} You earned ${points} bond points.`,
          cue: createCue(
            dotsBoxes.currentPlayer,
            winner === 'draw' ? 'Final box claimed' : 'Box secured',
            'That finished the board.',
            KISS_HEART,
            'win',
          ),
        })
        return
      }

      setDotsBoxes({
        ...dotsBoxes,
        lines,
        boxes,
        scores,
        cue: createCue(
          dotsBoxes.currentPlayer,
          completedBoxes.length > 1 ? 'Double box' : 'Box claimed',
          'You keep the turn.',
          KISS_HEART,
          'success',
        ),
      })
      return
    }

    const nextPlayer = partnerOf(dotsBoxes.currentPlayer)
    setDotsBoxes({
      ...dotsBoxes,
      lines,
      boxes,
      scores,
      currentPlayer: nextPlayer,
      cue: createCue(
        nextPlayer,
        'Line added',
        `${currentPlayerName(nextPlayer)}, your turn.`,
        THUMBS_UP,
        'soft',
      ),
    })
  }

  const startWordChain = () => {
    setWordChain(createWordChain())
    setWordChainDraft('')
    setScreen('word-chain')
  }

  const submitWordChainWord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!wordChain || wordChain.view !== 'play' || wordChain.validating) {
      return
    }

    const normalized = normalizeWord(wordChainDraft)
    if (!normalized) {
      setWordChain({
        ...wordChain,
        error: 'Type a word to keep the chain moving.',
      })
      return
    }

    if (!normalized.startsWith(wordChain.requiredLetter.toLowerCase())) {
      setWordChain({
        ...wordChain,
        error: `Your word has to start with ${wordChain.requiredLetter}.`,
      })
      return
    }

    if (wordChain.usedWords.includes(normalized)) {
      setWordChain({
        ...wordChain,
        error: 'That word was already used in this chain.',
      })
      return
    }

    setWordChain({
      ...wordChain,
      validating: true,
      error: '',
      statusMessage: `Checking "${normalized}"...`,
    })

    const isValid = await validateDictionaryWord(normalized)
    if (!isValid) {
      setWordChain((current) =>
        current
          ? {
              ...current,
              validating: false,
              error: `"${normalized}" did not pass the dictionary check.`,
              statusMessage: `${currentPlayerName(current.currentPlayer)}, try another word.`,
            }
          : current,
      )
      return
    }

    const nextLetter = getTerminalLetter(normalized)
    const nextPlayer = partnerOf(wordChain.currentPlayer)
    setWordChain({
      ...wordChain,
      currentPlayer: nextPlayer,
      requiredLetter: nextLetter,
      history: [...wordChain.history, { player: wordChain.currentPlayer, word: normalized }],
      usedWords: [...wordChain.usedWords, normalized],
      validating: false,
      error: '',
      cue: createCue(nextPlayer, 'Chain continues', `Use ${nextLetter} to answer back.`, KISS_HEART, 'success'),
      statusMessage: `${currentPlayerName(nextPlayer)} now needs a word that starts with ${nextLetter}.`,
    })
    setWordChainDraft('')
  }

  const giveUpWordChain = () => {
    if (!wordChain || wordChain.view !== 'play') {
      return
    }

    const winner = partnerOf(wordChain.currentPlayer)
    const chainLength = wordChain.history.length
    const points = 12 + chainLength
    const summary = `${currentPlayerName(winner)} wins after a ${chainLength}-word chain.`
    const newlyUnlocked = applyMatchResult('Word Chain', currentPlayerName(winner), points, summary)

    setWordChain({
      ...wordChain,
      view: 'result',
      winner,
      resultSummary:
        newlyUnlocked > 0
          ? `${summary} You unlocked ${newlyUnlocked} new reward${newlyUnlocked > 1 ? 's' : ''}.`
          : `${summary} You earned ${points} bond points.`,
      cue: createCue(winner, 'Chain snapped', 'That last letter was too much pressure.', THUMBS_UP, 'win'),
      statusMessage: summary,
      validating: false,
      error: '',
    })
    setWordChainDraft('')
  }

  const startGameFromHub = (key: (typeof PLAYABLE_GAMES)[number]['key']) => {
    switch (key) {
      case 'number-duel':
        startNumberDuel()
        return
      case 'mine-matrix':
        startMineMatrix()
        return
      case 'word-chain':
        startWordChain()
        return
      case 'truth-dare':
        startTruthOrDare()
        return
      case 'never-have-i-ever':
        startNeverHaveI()
        return
      case 'celebrity-guess':
        startCelebrityGuess()
        return
      case 'hangman':
        startHangman()
        return
      case 'tic-tac-toe':
        startTicTacToe()
        return
      case 'dots-boxes':
        startDotsBoxes()
        return
      default:
        return
    }
  }

  const activeNumberTracker =
    numberDuel?.view === 'guess' ? numberDuel.trackers[numberDuel.currentPlayer] : null
  const numberRevealCue = numberDuel?.cue
  const mineCue = mineMatrix?.cue
  const truthCue = truthOrDare?.cue
  const neverCue = neverHaveI?.cue
  const celebrityCue = celebrityGuess?.cue
  const hangmanCue = hangman?.cue
  const ticCue = ticTacToe?.cue
  const dotsCue = dotsBoxes?.cue
  const wordChainCue = wordChain?.cue
  const onlinePayload = onlineSession ? readOnlinePayload(onlineSession.roomState.payload) : null
  const onlineNumberDuel = onlinePayload?.numberDuel ?? null
  const onlineWordChain = onlinePayload?.wordChain ?? null
  const onlineRaceDash = onlinePayload?.raceDash ?? null
  const onlineTicTacToe = onlinePayload?.ticTacToe ?? null
  const onlineMineMatrix = onlinePayload?.mineMatrix ?? null
  const onlineTruthOrDare = onlinePayload?.truthOrDare ?? null
  const onlineNeverHaveI = onlinePayload?.neverHaveI ?? null
  const onlineCelebrityGuess = onlinePayload?.celebrityGuess ?? null
  const onlineHangman = onlinePayload?.hangman ?? null
  const onlineDotsBoxes = onlinePayload?.dotsBoxes ?? null
  const onlineChat = onlinePayload?.chat ?? []
  const latestPartnerEmoji =
    currentOnlinePlayerIndex === null
      ? null
      : [...onlineChat]
          .reverse()
          .find((entry) => entry.player !== currentOnlinePlayerIndex) ?? null
  const recentPartnerEmoji =
    latestPartnerEmoji && uiClock - new Date(latestPartnerEmoji.createdAt).getTime() < 9000
      ? latestPartnerEmoji
      : null
  const onlineRaceStartsAt = onlineRaceDash ? new Date(onlineRaceDash.startsAt).getTime() : 0
  const onlineRaceEndsAt = onlineRaceDash ? new Date(onlineRaceDash.endsAt).getTime() : 0
  const onlineRacePhase =
    onlineRaceDash?.phase === 'result'
      ? 'result'
      : raceClock < onlineRaceStartsAt
        ? 'countdown'
        : raceClock <= onlineRaceEndsAt
          ? 'racing'
          : 'result'
  const onlineRaceCountdown = onlineRaceDash
    ? Math.max(0, Math.ceil((onlineRaceStartsAt - raceClock) / 1000))
    : 0
  const onlineRaceTimeLeft = onlineRaceDash
    ? Math.max(0, Math.ceil((onlineRaceEndsAt - raceClock) / 1000))
    : 0
  const onlineEntryPanel = (
    <article className="panel online-entry-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Online mode</p>
          <h2>Play from two devices</h2>
        </div>
        <p className={`status-pill ${onlinePlayReady ? 'ready' : 'pending'}`}>
          {onlinePlayReady ? 'Ready' : 'Needs keys'}
        </p>
      </div>
      <p className="panel-note">
        Create a room on one device, join from the other, and keep the same room alive while you hop between games.
      </p>

      <div className="online-form-grid">
        <label>
          Your player name
          <input
            type="text"
            placeholder="Saad"
            value={onlineNameDraft}
            onChange={(event) => setOnlineNameDraft(event.target.value)}
          />
        </label>

        <label>
          Join room code
          <input
            type="text"
            placeholder="AB12CD"
            value={onlineCodeDraft}
            onChange={(event) => setOnlineCodeDraft(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          />
        </label>
      </div>

      <div className="color-picker-group">
        <strong>Your color</strong>
        <div className="color-swatches">
          {PLAYER_COLOR_OPTIONS.map((color) => (
            <button
              key={color}
              type="button"
              className={`color-swatch ${onlineColorDraft === color ? 'selected' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => setOnlineColorDraft(color)}
              aria-label={`Choose ${color}`}
            />
          ))}
        </div>
      </div>

      {onlineError ? <p className="online-error">{onlineError}</p> : null}

      <div className="hero-actions">
        <button
          type="button"
          className="primary-button"
          onClick={createOnlineRoomSession}
          disabled={!onlinePlayReady || onlineBusyAction !== null}
        >
          {onlineBusyAction === 'create' ? 'Creating room...' : 'Create Room'}
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={joinOnlineRoomSession}
          disabled={!onlinePlayReady || onlineBusyAction !== null}
        >
          {onlineBusyAction === 'join' ? 'Joining...' : 'Join Room'}
        </button>
      </div>
    </article>
  )

  return (
    <div className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Same-screen couples arcade</p>
          <h1>Build your own little ritual of fun, teasing, and bonding.</h1>
          <p className="hero-text">
            Take turns on one screen, stack bond points, unlock real-world rewards, and
            build a full date-night game shelf together.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="primary-button"
              onClick={playersReady ? startNumberDuel : openSetup}
            >
              {playersReady ? 'Play Number Duel' : 'Set Up Players'}
            </button>
            {playersReady ? (
              <>
                <button type="button" className="ghost-button" onClick={startMineMatrix}>
                  Play Mine Matrix
                </button>
                <button type="button" className="ghost-button" onClick={openSetup}>
                  Edit Players
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className="couple-stage" aria-hidden="true">
          <div className="glow one"></div>
          <div className="glow two"></div>
          <div className="spark heart heart-one"></div>
          <div className="spark heart heart-two"></div>
          <div className="spark dot dot-one"></div>
          <div className="spark dot dot-two"></div>

          <Character
            side="left"
            color={profile.playerColors[0]}
            mood={getHeroCharacterMood(0)}
            energy={getHeroCharacterEnergy(0)}
          />
          <Character
            side="right"
            color={profile.playerColors[1]}
            mood={getHeroCharacterMood(1)}
            energy={getHeroCharacterEnergy(1)}
          />

          <div className="bond-orb">
            <span>{profile.bondScore}</span>
            <small>bond</small>
          </div>
        </div>
      </section>

      {screen === 'setup' ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">First launch</p>
              <h2>Name your duo</h2>
            </div>
            <p className="panel-note">
              You can rename both players later. Progress stays saved in this browser.
            </p>
          </div>

          <form className="setup-form" onSubmit={savePlayers}>
            <label>
              Player One
              <input
                type="text"
                placeholder="Avery"
                value={setupNames[0]}
                onChange={(event) => setSetupNames([event.target.value, setupNames[1]])}
              />
            </label>

            <div className="color-picker-group">
              <span>Player One Character Color</span>
              <div className="color-swatches">
                {PLAYER_COLOR_OPTIONS.map((color) => (
                  <button
                    key={`p1-${color}`}
                    type="button"
                    className={`color-swatch ${setupColors[0] === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setSetupColors([color, setupColors[1]])}
                    aria-label={`Choose ${color} for player one`}
                  />
                ))}
              </div>
            </div>

            <label>
              Player Two
              <input
                type="text"
                placeholder="Jordan"
                value={setupNames[1]}
                onChange={(event) => setSetupNames([setupNames[0], event.target.value])}
              />
            </label>

            <div className="color-picker-group">
              <span>Player Two Character Color</span>
              <div className="color-swatches">
                {PLAYER_COLOR_OPTIONS.map((color) => (
                  <button
                    key={`p2-${color}`}
                    type="button"
                    className={`color-swatch ${setupColors[1] === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setSetupColors([setupColors[0], color])}
                    aria-label={`Choose ${color} for player two`}
                  />
                ))}
              </div>
            </div>

            <button type="submit" className="primary-button wide-button">
              Save and Start
            </button>
          </form>

          <div className="setup-divider"></div>
          {onlineEntryPanel}
        </section>
      ) : null}

      {screen === 'home' ? (
        <>
          <section className="panel mode-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Choose your mode</p>
                <h2>Launch like a game, not a webpage</h2>
              </div>
              <p className="panel-note">Swap between same-computer play and room-based online play.</p>
            </div>
            <div className="mode-switch">
              <button
                type="button"
                className={`mode-switch-button ${homeMode === 'same-screen' ? 'active' : ''}`}
                onClick={() => setHomeMode('same-screen')}
              >
                Same Computer
              </button>
              <button
                type="button"
                className={`mode-switch-button ${homeMode === 'online' ? 'active' : ''}`}
                onClick={() => setHomeMode('online')}
              >
                Online
              </button>
            </div>
          </section>

          {homeMode === 'same-screen' ? (
            <>
              <section className="dashboard-grid">
                <article className="panel bond-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Bond meter</p>
                      <h2>
                        {profile.players[0]} + {profile.players[1]}
                      </h2>
                    </div>
                    <p className="score-pill">{profile.bondScore} pts</p>
                  </div>

                  <div className="meter-track" role="presentation">
                    <div className="meter-fill" style={{ width: `${meterProgress}%` }}></div>
                  </div>

                  <div className="stats-row">
                    <div>
                      <strong>{profile.matchesPlayed}</strong>
                      <span>matches played</span>
                    </div>
                    <div>
                      <strong>{profile.unlockedRewardIds.length}</strong>
                      <span>rewards unlocked</span>
                    </div>
                    <div>
                      <strong>{PLAYABLE_GAMES.length}</strong>
                      <span>games live</span>
                    </div>
                  </div>

                  <p className="panel-note">
                    {nextReward
                      ? `${nextReward.threshold - profile.bondScore} more points to unlock "${nextReward.title}".`
                      : 'All current rewards are unlocked. Add a harder milestone after QA.'}
                  </p>
                </article>

                <article className="panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Playable collection</p>
                      <h2>Game shelf</h2>
                    </div>
                  </div>
                  <div className="game-grid">
                    {PLAYABLE_GAMES.map((game) => (
                      <GameTile
                        key={game.key}
                        title={game.title}
                        description={game.description}
                        accent={game.accent}
                        action={() => startGameFromHub(game.key)}
                      />
                    ))}
                  </div>
                </article>
              </section>

              <section className="dashboard-grid">
                <article className="panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Rewards</p>
                      <h2>Date unlocks</h2>
                    </div>
                  </div>

                  <div className="reward-grid">
                    {REWARDS.map((reward) => {
                      const unlocked = profile.unlockedRewardIds.includes(reward.id)

                      return (
                        <article
                          key={reward.id}
                          className={`reward-card ${unlocked ? 'unlocked' : 'locked'}`}
                        >
                          <span className="reward-threshold">{reward.threshold} pts</span>
                          <h3>{reward.title}</h3>
                          <p>{reward.description}</p>
                        </article>
                      )
                    })}
                  </div>
                </article>

                <article className="panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Recent moments</p>
                      <h2>Match feed</h2>
                    </div>
                  </div>

                  {profile.history.length > 0 ? (
                    <div className="history-list">
                      {profile.history.map((entry) => (
                        <article key={entry.id} className="history-card">
                          <div>
                            <strong>{entry.game}</strong>
                            <p>{entry.summary}</p>
                          </div>
                          <div className="history-meta">
                            <span>{entry.winner}</span>
                            <small>+{entry.points} bond</small>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="panel-note">
                      Play your first few rounds and your shared story will start filling this feed.
                    </p>
                  )}
                </article>
              </section>
            </>
          ) : (
            <>
              {onlineSession ? (
                <section className="dashboard-grid">
                  <article className="panel online-resume-panel">
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">Current room</p>
                        <h2>Room {onlineSession.roomCode}</h2>
                      </div>
                      <p className="status-pill ready">
                        {onlineSession.players[1] ? 'Two players ready' : 'Waiting for partner'}
                      </p>
                    </div>
                    <p className="panel-note">
                      Your room stays open between games now, so you can jump back into the same lobby.
                    </p>
                    <div className="hero-actions">
                      <button type="button" className="primary-button" onClick={resumeOnlineRoom}>
                        Resume Room
                      </button>
                      <button type="button" className="ghost-button" onClick={leaveOnlineRoom}>
                        Leave Room
                      </button>
                    </div>
                  </article>
                </section>
              ) : null}

              <section className="dashboard-grid">{onlineEntryPanel}</section>
            </>
          )}
        </>
      ) : null}

      {screen === 'online-room' && onlineSession ? (
        <section className="panel duel-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Online room</p>
              <h2>Room {onlineSession.roomCode}</h2>
            </div>
            <div className="result-actions">
              {onlineSession.roomState.activeGame !== 'lobby' ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={returnOnlineRoomToLobby}
                  disabled={onlineSession.role !== 'host' || onlineBusyAction === 'sync'}
                >
                  {onlineBusyAction === 'sync' ? 'Returning...' : 'Back to Lobby'}
                </button>
              ) : null}
              <button type="button" className="ghost-button" onClick={refreshOnlineRoom}>
                Refresh Room
              </button>
              <button type="button" className="ghost-button" onClick={leaveOnlineRoom}>
                Leave Room
              </button>
            </div>
          </div>

          <div className="scoreboard-row">
            <div className="score-chip">
              <strong>Connection</strong>
              <span>{onlineSession.connectionStatus === 'live' ? 'Live' : 'Connecting'}</span>
            </div>
            <div className="score-chip">
              <strong>Players online</strong>
              <span>{onlineSession.onlineCount}</span>
            </div>
            <div className="score-chip">
              <strong>Role</strong>
              <span>{onlineSession.role === 'host' ? 'Host' : 'Guest'}</span>
            </div>
          </div>

          <div className="online-room-grid">
            <article className="turn-card">
              <p className="turn-tag">Players</p>
              <div className="online-player-list">
                {[0, 1].map((playerIndex) => (
                  <div key={playerIndex} className="online-player-card">
                    <span
                      className="online-player-dot"
                      style={{ backgroundColor: onlineSession.colors[playerIndex as PlayerIndex] }}
                    ></span>
                    <div>
                      <strong>{onlinePlayerName(playerIndex as PlayerIndex)}</strong>
                      <p className="panel-note">
                        {playerIndex === currentOnlinePlayerIndex
                          ? 'You'
                          : playerIndex === 1 && !onlineSession.players[1]
                            ? 'Waiting to join'
                            : 'Partner'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {onlineError ? <p className="online-error">{onlineError}</p> : null}
              <p className="panel-note">
                Share room code <strong>{onlineSession.roomCode}</strong> with your partner if they
                have not joined yet.
              </p>
              <div className="online-chat-panel">
                <div className="panel-heading online-chat-heading">
                  <div>
                    <p className="turn-tag">Emoji chat</p>
                    <h3>Quick reactions</h3>
                  </div>
                </div>
                <div className="emoji-toolbar">
                  {ONLINE_CHAT_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="emoji-button"
                      onClick={() => void sendOnlineEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="emoji-feed">
                  {onlineChat.length > 0 ? (
                    [...onlineChat].reverse().map((entry) => (
                      <article
                        key={entry.id}
                        className={`emoji-feed-item ${entry.player === currentOnlinePlayerIndex ? 'self' : 'partner'}`}
                      >
                        <strong>{onlinePlayerName(entry.player)}</strong>
                        <span>{entry.emoji}</span>
                      </article>
                    ))
                  ) : (
                    <p className="panel-note">Send a heart, roast, or panic emoji while you play.</p>
                  )}
                </div>
              </div>
            </article>

            <article className="turn-card">
              {onlineSession.roomState.activeGame !== 'lobby' && recentPartnerEmoji ? (
                <div className="emoji-pop">
                  <span className="emoji-pop-mark">{recentPartnerEmoji.emoji}</span>
                  <span>{onlinePlayerName(recentPartnerEmoji.player)} pinged you</span>
                </div>
              ) : null}
              {onlineSession.roomState.activeGame === 'lobby' ? (
                <>
                  <p className="turn-tag">Lobby</p>
                  <h3>Choose the next online minigame</h3>
                  <p className="panel-note">
                    {onlineSession.players[1]
                      ? `${onlinePlayerName(1)} joined. The host can launch any online game from here.`
                      : 'Waiting for a second player to join this room.'}
                  </p>
                  <p className="panel-note">
                    {onlineSession.role === 'host'
                      ? 'You are the host for this room.'
                      : `Waiting for ${onlinePlayerName(0)} to start the online match.`}
                  </p>
                  <div className="online-lobby-actions">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={startOnlineNumberDuel}
                      disabled={
                        onlineSession.role !== 'host' ||
                        !onlineSession.players[1] ||
                        onlineBusyAction !== null
                      }
                    >
                      {onlineBusyAction === 'start' ? 'Starting...' : 'Start Online Number Duel'}
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={startOnlineWordChain}
                      disabled={
                        onlineSession.role !== 'host' ||
                        !onlineSession.players[1] ||
                        onlineBusyAction !== null
                      }
                    >
                      {onlineBusyAction === 'start' ? 'Starting...' : 'Start Online Word Chain'}
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={startOnlineRaceDash}
                      disabled={
                        onlineSession.role !== 'host' ||
                        !onlineSession.players[1] ||
                        onlineBusyAction !== null
                      }
                    >
                      {onlineBusyAction === 'start' ? 'Starting...' : 'Start Race Dash'}
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={startOnlineTicTacToe}
                      disabled={
                        onlineSession.role !== 'host' ||
                        !onlineSession.players[1] ||
                        onlineBusyAction !== null
                      }
                    >
                      {onlineBusyAction === 'start' ? 'Starting...' : 'Start Online Tic Tac Toe'}
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={startOnlineMineMatrix}
                      disabled={
                        onlineSession.role !== 'host' ||
                        !onlineSession.players[1] ||
                        onlineBusyAction !== null
                      }
                    >
                      {onlineBusyAction === 'start' ? 'Starting...' : 'Start Online Mine Matrix'}
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={startOnlineTruthOrDare}
                      disabled={
                        onlineSession.role !== 'host' ||
                        !onlineSession.players[1] ||
                        onlineBusyAction !== null
                      }
                    >
                      {onlineBusyAction === 'start' ? 'Starting...' : 'Start Online Truth or Dare'}
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={startOnlineNeverHaveI}
                      disabled={
                        onlineSession.role !== 'host' ||
                        !onlineSession.players[1] ||
                        onlineBusyAction !== null
                      }
                    >
                      {onlineBusyAction === 'start' ? 'Starting...' : 'Start Online Never Have I Ever'}
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={startOnlineCelebrityGuess}
                      disabled={
                        onlineSession.role !== 'host' ||
                        !onlineSession.players[1] ||
                        onlineBusyAction !== null
                      }
                    >
                      {onlineBusyAction === 'start' ? 'Starting...' : 'Start Online Celebrity Guess'}
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={startOnlineHangman}
                      disabled={
                        onlineSession.role !== 'host' ||
                        !onlineSession.players[1] ||
                        onlineBusyAction !== null
                      }
                    >
                      {onlineBusyAction === 'start' ? 'Starting...' : 'Start Online Hangman'}
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={startOnlineDotsBoxes}
                      disabled={
                        onlineSession.role !== 'host' ||
                        !onlineSession.players[1] ||
                        onlineBusyAction !== null
                      }
                    >
                      {onlineBusyAction === 'start' ? 'Starting...' : 'Start Online Dots and Boxes'}
                    </button>
                  </div>
                </>
              ) : null}

              {onlineSession.roomState.activeGame === 'number-duel' && onlineNumberDuel ? (
                <>
                  <p className="turn-tag">Online Number Duel</p>

                  {onlineNumberDuel.cue ? (
                    <FeedbackScene
                      cue={onlineNumberDuel.cue}
                      speakerName={onlinePlayerName(onlineNumberDuel.cue.speaker)}
                      speakerColor={onlineSession.colors[onlineNumberDuel.cue.speaker]}
                    />
                  ) : null}

                  {onlineNumberDuel.phase === 'setup' && currentOnlinePlayerIndex !== null ? (
                    <div className="online-stack">
                      <h3>Lock your secret number</h3>
                      <p className="panel-note">
                        Each player picks a number from 1 to 999 on their own device.
                      </p>
                      <div className="scoreboard-row">
                        {[0, 1].map((playerIndex) => (
                          <div key={playerIndex} className="score-chip">
                            <strong>{onlinePlayerName(playerIndex as PlayerIndex)}</strong>
                            <span>
                              {onlineNumberDuel.ready[playerIndex as PlayerIndex] ? 'Ready' : 'Waiting'}
                            </span>
                          </div>
                        ))}
                      </div>
                      {!onlineNumberDuel.ready[currentOnlinePlayerIndex] ? (
                        <form className="duel-form" onSubmit={submitOnlineSecret}>
                          <input
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={3}
                            placeholder="Hidden number"
                            value={secretDraft}
                            onChange={(event) =>
                              setSecretDraft(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))
                            }
                          />
                          <button type="submit" className="primary-button">
                            Lock Secret
                          </button>
                        </form>
                      ) : (
                        <p className="panel-note">Your number is locked. Waiting for your partner.</p>
                      )}
                    </div>
                  ) : null}

                  {onlineNumberDuel.phase === 'guess' &&
                  currentOnlinePlayerIndex !== null &&
                  onlineNumberDuel.trackers[currentOnlinePlayerIndex] ? (
                    <div className="online-stack">
                      <h3>
                        {onlineNumberDuel.currentTurn === currentOnlinePlayerIndex
                          ? 'Your turn to guess'
                          : `${onlinePlayerName(onlineNumberDuel.currentTurn)} is guessing`}
                      </h3>
                      <div className="tracker-grid">
                        {[0, 1].map((playerIndex) => {
                          const tracker = onlineNumberDuel.trackers[playerIndex as PlayerIndex]
                          const isActive = onlineNumberDuel.currentTurn === playerIndex

                          return (
                            <article
                              key={playerIndex}
                              className={`tracker-card ${isActive ? 'active' : ''}`}
                            >
                              <p>{onlinePlayerName(playerIndex as PlayerIndex)}</p>
                              <strong>{tracker?.attempts ?? 0} attempts</strong>
                              <span>
                                Range: {tracker?.min ?? 1} - {tracker?.max ?? 999}
                              </span>
                              <ul>
                                {(tracker?.recentHints ?? []).map((hint) => (
                                  <li key={hint}>{hint}</li>
                                ))}
                              </ul>
                            </article>
                          )
                        })}
                      </div>

                      {onlineNumberDuel.currentTurn === currentOnlinePlayerIndex ? (
                        <form className="duel-form" onSubmit={submitOnlineGuess}>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={3}
                            placeholder="Your guess"
                            value={guessDraft}
                            onChange={(event) =>
                              setGuessDraft(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))
                            }
                          />
                          <button type="submit" className="primary-button">
                            Guess
                          </button>
                        </form>
                      ) : (
                        <p className="panel-note">
                          Watching {onlinePlayerName(onlineNumberDuel.currentTurn)} take this turn.
                        </p>
                      )}
                    </div>
                  ) : null}

                  {onlineNumberDuel.phase === 'reveal' ? (
                    <div className="online-stack">
                      <h3>{onlineNumberDuel.statusMessage}</h3>
                      <p className="panel-note">
                        The clue is live for both of you. Start the next turn when you are ready.
                      </p>
                      <button type="button" className="primary-button" onClick={advanceOnlineReveal}>
                        Start Next Turn
                      </button>
                    </div>
                  ) : null}

                  {onlineNumberDuel.phase === 'result' && onlineNumberDuel.winner !== null ? (
                    <div className="online-stack">
                      <ResultStage winner={onlineNumberDuel.winner} colors={onlineSession.colors} />
                      <h3>{onlinePlayerName(onlineNumberDuel.winner)} wins the online duel</h3>
                      <p className="panel-note">{onlineNumberDuel.statusMessage}</p>
                      <div className="result-actions">
                        <button
                          type="button"
                          className="primary-button"
                          onClick={startOnlineNumberDuel}
                          disabled={onlineBusyAction !== null}
                        >
                          {onlineBusyAction === 'start' ? 'Restarting...' : 'Play Again'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {onlineSession.roomState.activeGame === 'race-dash' && onlineRaceDash ? (
                <>
                  <p className="turn-tag">Race Dash</p>
                  {onlineRaceDash.cue ? (
                    <FeedbackScene
                      cue={onlineRaceDash.cue}
                      speakerName={onlinePlayerName(onlineRaceDash.cue.speaker)}
                      speakerColor={onlineSession.colors[onlineRaceDash.cue.speaker]}
                    />
                  ) : null}

                  <div className="online-stack game-stage-3d">
                    <div className="scoreboard-row">
                      <div className="score-chip">
                        <strong>Status</strong>
                        <span>
                          {onlineRacePhase === 'countdown'
                            ? `Starts in ${onlineRaceCountdown}`
                            : onlineRacePhase === 'racing'
                              ? `${onlineRaceTimeLeft}s left`
                              : 'Race complete'}
                        </span>
                      </div>
                      <div className="score-chip">
                        <strong>Target</strong>
                        <span>{onlineRaceDash.targetTaps} taps</span>
                      </div>
                    </div>

                    <div className={`race-scene race-scene-${onlineRacePhase}`}>
                      <div className="scene-glow scene-glow-left"></div>
                      <div className="scene-glow scene-glow-right"></div>
                      <div className="scene-stripes"></div>
                    <div className="race-lane-list">
                      {[0, 1].map((playerIndex) => (
                        <article
                          key={playerIndex}
                          className={`race-lane-card depth-card ${
                            onlineRaceDash.progress[playerIndex as PlayerIndex] > 0 ? 'is-moving' : ''
                          } ${
                            onlineRaceDash.winner === playerIndex ? 'is-winning' : ''
                          }`}
                        >
                          <div className="race-lane-header">
                            <strong>{onlinePlayerName(playerIndex as PlayerIndex)}</strong>
                            <span>{onlineRaceDash.taps[playerIndex as PlayerIndex]} taps</span>
                          </div>
                          <div className="race-track">
                            <div className="race-track-floor"></div>
                            <div
                              className="race-runner"
                              style={{
                                left: `${Math.min(
                                  92,
                                  onlineRaceDash.progress[playerIndex as PlayerIndex],
                                )}%`,
                                '--runner-color':
                                  onlineSession.colors[playerIndex as PlayerIndex],
                              } as CSSProperties}
                            >
                              <span className="race-runner-shadow"></span>
                              <span className="race-runner-core"></span>
                              <span className="race-runner-emoji">
                                {playerIndex === 0 ? '🏃' : '💨'}
                              </span>
                              <span className="race-runner-dust dust-one"></span>
                              <span className="race-runner-dust dust-two"></span>
                            </div>
                          </div>
                          <p className="panel-note">
                            {onlineRaceDash.progress[playerIndex as PlayerIndex]}% to the finish line
                          </p>
                        </article>
                      ))}
                    </div>
                    </div>

                    {currentOnlinePlayerIndex !== null && onlineRacePhase !== 'result' ? (
                      <button
                        type="button"
                        className={`primary-button race-button depth-button ${
                          onlineRacePhase === 'racing' ? 'is-hot' : ''
                        }`}
                        onClick={() => void pushOnlineRaceStep()}
                        disabled={onlineRacePhase !== 'racing'}
                      >
                        {onlineRacePhase === 'countdown'
                          ? 'Wait for GO'
                          : 'Tap Fast or Hit Space'}
                      </button>
                    ) : null}

                    {onlineRacePhase === 'result' ? (
                      <div className="online-stack">
                        <ResultStage winner={onlineRaceDash.winner} colors={onlineSession.colors} />
                        <h3>
                          {onlineRaceDash.winner === 'draw'
                            ? 'Race Dash ends in a tie'
                            : `${onlinePlayerName(onlineRaceDash.winner as PlayerIndex)} wins Race Dash`}
                        </h3>
                        <p className="panel-note">{onlineRaceDash.statusMessage}</p>
                        <div className="result-actions">
                          <button
                            type="button"
                            className="primary-button"
                            onClick={startOnlineRaceDash}
                            disabled={onlineBusyAction !== null}
                          >
                            {onlineBusyAction === 'start' ? 'Restarting...' : 'Race Again'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="panel-note">{onlineRaceDash.statusMessage}</p>
                    )}
                  </div>
                </>
              ) : null}

              {onlineSession.roomState.activeGame === 'word-chain' && onlineWordChain ? (
                <>
                  <p className="turn-tag">Online Word Chain</p>
                  {onlineWordChain.cue ? (
                    <FeedbackScene
                      cue={onlineWordChain.cue}
                      speakerName={onlinePlayerName(onlineWordChain.cue.speaker)}
                      speakerColor={onlineSession.colors[onlineWordChain.cue.speaker]}
                    />
                  ) : null}

                  {onlineWordChain.phase === 'play' ? (
                    <div className="duel-layout">
                      <div className="turn-card">
                        <p className="turn-tag">
                          {currentOnlinePlayerIndex === onlineWordChain.currentPlayer
                            ? 'Your turn'
                            : `${onlinePlayerName(onlineWordChain.currentPlayer)} is up`}
                        </p>
                        <div className="scoreboard-row">
                          <div className="score-chip">
                            <strong>Starter letter</strong>
                            <span>{onlineWordChain.requiredLetter}</span>
                          </div>
                          <div className="score-chip">
                            <strong>Chain length</strong>
                            <span>{onlineWordChain.history.length} words</span>
                          </div>
                        </div>
                        <h3>Use a word that starts with {onlineWordChain.requiredLetter}</h3>
                        <p className="panel-note">{onlineWordChain.statusMessage}</p>
                        <form className="duel-form" onSubmit={submitOnlineWordChainWord}>
                          <input
                            type="text"
                            placeholder={`Word starting with ${onlineWordChain.requiredLetter}`}
                            value={wordChainDraft}
                            onChange={(event) => setWordChainDraft(event.target.value)}
                            disabled={
                              currentOnlinePlayerIndex !== onlineWordChain.currentPlayer ||
                              onlineBusyAction === 'sync'
                            }
                          />
                          {onlineError ? <p className="online-error">{onlineError}</p> : null}
                          <div className="result-actions">
                            <button
                              type="submit"
                              className="primary-button"
                              disabled={
                                currentOnlinePlayerIndex !== onlineWordChain.currentPlayer ||
                                onlineBusyAction === 'sync'
                              }
                            >
                              {onlineBusyAction === 'sync' ? 'Checking...' : 'Lock Word'}
                            </button>
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={giveUpOnlineWordChain}
                              disabled={
                                currentOnlinePlayerIndex !== onlineWordChain.currentPlayer ||
                                onlineBusyAction === 'sync'
                              }
                            >
                              Give Up
                            </button>
                          </div>
                        </form>
                      </div>

                      <div className="tracker-card">
                        <p>Chain history</p>
                        {onlineWordChain.history.length > 0 ? (
                          <ul>
                            {onlineWordChain.history
                              .slice()
                              .reverse()
                              .map((entry, index) => (
                                <li key={`${entry.word}-${index}`}>
                                  {onlinePlayerName(entry.player)}: {entry.word}
                                </li>
                              ))}
                          </ul>
                        ) : (
                          <p className="panel-note">No words yet. Start the chain strong.</p>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {onlineWordChain.phase === 'result' && onlineWordChain.winner !== null ? (
                    <div className="online-stack">
                      <ResultStage winner={onlineWordChain.winner} colors={onlineSession.colors} />
                      <h3>{onlinePlayerName(onlineWordChain.winner)} wins Online Word Chain</h3>
                      <p className="panel-note">{onlineWordChain.resultSummary}</p>
                      <div className="scoreboard-row">
                        <div className="score-chip">
                          <strong>Final chain</strong>
                          <span>{onlineWordChain.history.length} words</span>
                        </div>
                      </div>
                      <div className="result-actions">
                        <button
                          type="button"
                          className="primary-button"
                          onClick={startOnlineWordChain}
                          disabled={onlineBusyAction !== null}
                        >
                          {onlineBusyAction === 'start' ? 'Restarting...' : 'Play Again'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {onlineSession.roomState.activeGame === 'tic-tac-toe' && onlineTicTacToe ? (
                <>
                  <p className="turn-tag">Online Tic Tac Toe</p>
                  {onlineTicTacToe.cue ? (
                    <FeedbackScene
                      cue={onlineTicTacToe.cue}
                      speakerName={onlinePlayerName(onlineTicTacToe.cue.speaker)}
                      speakerColor={onlineSession.colors[onlineTicTacToe.cue.speaker]}
                    />
                  ) : null}

                  {onlineTicTacToe.phase === 'play' ? (
                    <div className="online-stack">
                      <h3>
                        {currentOnlinePlayerIndex === onlineTicTacToe.currentTurn
                          ? 'Your move'
                          : `${onlinePlayerName(onlineTicTacToe.currentTurn)} is up`}
                      </h3>
                      <div className="tic-board online-tic-board">
                        {onlineTicTacToe.board.map((cell, index) => (
                          <button
                            key={index}
                            type="button"
                            className="tic-cell"
                            onClick={() => void playOnlineTicTacToeMove(index)}
                            disabled={
                              cell !== null || currentOnlinePlayerIndex !== onlineTicTacToe.currentTurn
                            }
                          >
                            {cell === 0 ? 'X' : cell === 1 ? 'O' : ''}
                          </button>
                        ))}
                      </div>
                      <p className="panel-note">{onlineTicTacToe.statusMessage}</p>
                    </div>
                  ) : null}

                  {onlineTicTacToe.phase === 'result' ? (
                    <div className="online-stack">
                      <ResultStage winner={onlineTicTacToe.winner} colors={onlineSession.colors} />
                      <h3>
                        {onlineTicTacToe.winner === 'draw'
                          ? 'Online Tic Tac Toe ends in a draw'
                          : `${onlinePlayerName(onlineTicTacToe.winner as PlayerIndex)} wins Online Tic Tac Toe`}
                      </h3>
                      <p className="panel-note">{onlineTicTacToe.statusMessage}</p>
                      <div className="result-actions">
                        <button
                          type="button"
                          className="primary-button"
                          onClick={startOnlineTicTacToe}
                          disabled={onlineBusyAction !== null}
                        >
                          {onlineBusyAction === 'start' ? 'Restarting...' : 'Play Again'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {onlineSession.roomState.activeGame === 'mine-matrix' && onlineMineMatrix ? (
                <>
                  <p className="turn-tag">Online Mine Matrix</p>
                  {onlineMineMatrix.cue ? (
                    <FeedbackScene
                      cue={onlineMineMatrix.cue}
                      speakerName={onlinePlayerName(onlineMineMatrix.cue.speaker)}
                      speakerColor={onlineSession.colors[onlineMineMatrix.cue.speaker]}
                    />
                  ) : null}
                  {onlineMineMatrix.phase === 'setup' && currentOnlinePlayerIndex !== null ? (
                    <div className="online-stack game-stage-3d">
                      <h3>Plant 3 hidden mines</h3>
                      <div className="scoreboard-row">
                        {[0, 1].map((playerIndex) => (
                          <div key={playerIndex} className="score-chip">
                            <strong>{onlinePlayerName(playerIndex as PlayerIndex)}</strong>
                            <span>{onlineMineMatrix.ready[playerIndex as PlayerIndex] ? 'Ready' : 'Placing'}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mine-grid mine-grid-3d">
                        {GRID_CELLS.map((cell) => {
                          const selected = includesCell(
                            onlineMineMatrix.plantingSelections[currentOnlinePlayerIndex],
                            cell,
                          )
                          return (
                            <button
                              key={cell}
                              type="button"
                              className={`mine-cell ${selected ? 'selected is-lifted' : ''}`}
                              onClick={() => void toggleOnlineMineSelection(cell)}
                              disabled={onlineMineMatrix.ready[currentOnlinePlayerIndex]}
                            >
                              {selected ? MINE_ICON : ''}
                            </button>
                          )
                        })}
                      </div>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={confirmOnlineMineSetup}
                        disabled={
                          onlineMineMatrix.ready[currentOnlinePlayerIndex] ||
                          onlineMineMatrix.plantingSelections[currentOnlinePlayerIndex].length !== 3
                        }
                      >
                        Lock Mine Layout
                      </button>
                    </div>
                  ) : null}
                  {onlineMineMatrix.phase === 'play' && currentOnlinePlayerIndex !== null ? (
                    <div className="online-stack game-stage-3d">
                      <h3>
                        {onlineMineMatrix.currentTurn === currentOnlinePlayerIndex
                          ? 'Your turn to bite'
                          : `${onlinePlayerName(onlineMineMatrix.currentTurn)} is choosing`}
                      </h3>
                      <div className="scoreboard-row">
                        <div className="score-chip">
                          <strong>{onlinePlayerName(0)}</strong>
                          <span>{onlineMineMatrix.mineHits[0]} strikes</span>
                        </div>
                        <div className="score-chip">
                          <strong>{onlinePlayerName(1)}</strong>
                          <span>{onlineMineMatrix.mineHits[1]} strikes</span>
                        </div>
                      </div>
                      <div className="mine-grid mine-grid-3d">
                        {GRID_CELLS.map((cell) => {
                          const defender = partnerOf(onlineMineMatrix.currentTurn)
                          const revealed = includesCell(onlineMineMatrix.revealedBoards[defender], cell)
                          const isMine = includesCell(onlineMineMatrix.mineBoards[defender], cell)
                          return (
                            <button
                              key={cell}
                              type="button"
                              className={`mine-cell ${
                                revealed ? (isMine ? 'mine-hit' : 'safe-hit') : ''
                              }`}
                              onClick={() => void revealOnlineMineCell(cell)}
                              disabled={revealed || onlineMineMatrix.currentTurn !== currentOnlinePlayerIndex}
                            >
                              {revealed ? (isMine ? MINE_ICON : SAFE_ICON) : '?'}
                            </button>
                          )
                        })}
                      </div>
                      <p className="panel-note">{onlineMineMatrix.statusMessage}</p>
                    </div>
                  ) : null}
                  {onlineMineMatrix.phase === 'reveal' && onlineMineMatrix.pendingTarget !== null ? (
                    <div className="online-stack game-stage-3d">
                      <h3>{onlineMineMatrix.pendingHit ? 'Mine hit' : 'Safe bite'}</h3>
                      <div className="mine-grid mine-grid-3d reveal-board">
                        {GRID_CELLS.map((cell) => {
                          const targetBoard = onlineMineMatrix.pendingTarget as PlayerIndex
                          const revealed = includesCell(onlineMineMatrix.revealedBoards[targetBoard], cell)
                          const isMine = includesCell(onlineMineMatrix.mineBoards[targetBoard], cell)
                          const isPending = cell === onlineMineMatrix.pendingCell
                          return (
                            <button
                              key={cell}
                              type="button"
                              className={`mine-cell ${
                                revealed ? (isMine ? 'mine-hit' : 'safe-hit') : ''
                              } ${isPending ? 'mine-focus pop-3d' : ''}`}
                              disabled
                            >
                              {revealed ? (isMine ? MINE_ICON : SAFE_ICON) : '?'}
                            </button>
                          )
                        })}
                      </div>
                      <p className={`mine-reveal-banner ${onlineMineMatrix.pendingHit ? 'danger' : 'safe'}`}>
                        {onlineMineMatrix.pendingHit ? `${MINE_ICON} Boom` : `${SAFE_ICON} Safe`}
                      </p>
                      <div className={`mine-burst ${onlineMineMatrix.pendingHit ? 'danger' : 'safe'}`}>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <p className="panel-note">{onlineMineMatrix.statusMessage}</p>
                      <button type="button" className="primary-button" onClick={advanceOnlineMineReveal}>
                        {onlineMineMatrix.resolvingResult ? 'Show Result' : 'Next Turn'}
                      </button>
                    </div>
                  ) : null}
                  {onlineMineMatrix.phase === 'result' && onlineMineMatrix.winner !== null ? (
                    <div className="online-stack">
                      <ResultStage winner={onlineMineMatrix.winner} colors={onlineSession.colors} />
                      <h3>{onlinePlayerName(onlineMineMatrix.winner)} wins Online Mine Matrix</h3>
                      <p className="panel-note">{onlineMineMatrix.statusMessage}</p>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={startOnlineMineMatrix}
                        disabled={onlineBusyAction !== null}
                      >
                        {onlineBusyAction === 'start' ? 'Restarting...' : 'Play Again'}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}

              {onlineSession.roomState.activeGame === 'truth-dare' && onlineTruthOrDare ? (
                <>
                  <p className="turn-tag">Online Truth or Dare</p>
                  {onlineTruthOrDare.cue ? (
                    <FeedbackScene
                      cue={onlineTruthOrDare.cue}
                      speakerName={onlinePlayerName(onlineTruthOrDare.cue.speaker)}
                      speakerColor={onlineSession.colors[onlineTruthOrDare.cue.speaker]}
                    />
                  ) : null}
                  <div className="scoreboard-row">
                    <div className="score-chip">
                      <strong>{onlinePlayerName(0)}</strong>
                      <span>{onlineTruthOrDare.scores[0]} cards</span>
                    </div>
                    <div className="score-chip">
                      <strong>Round {onlineTruthOrDare.round}</strong>
                      <span>of {onlineTruthOrDare.totalRounds}</span>
                    </div>
                    <div className="score-chip">
                      <strong>{onlinePlayerName(1)}</strong>
                      <span>{onlineTruthOrDare.scores[1]} cards</span>
                    </div>
                  </div>
                  {onlineTruthOrDare.phase === 'choose' ? (
                    <div className="online-stack">
                      <h3>
                        {currentOnlinePlayerIndex === onlineTruthOrDare.currentPlayer
                          ? 'Choose Truth or Dare'
                          : `${onlinePlayerName(onlineTruthOrDare.currentPlayer)} is choosing`}
                      </h3>
                      <div className="truth-choice-grid">
                        <button
                          type="button"
                          className="choice-card truth-choice"
                          onClick={() => void drawOnlineTruthOrDareCard('Truth')}
                          disabled={currentOnlinePlayerIndex !== onlineTruthOrDare.currentPlayer}
                        >
                          <strong>Truth</strong>
                          <span>Share something real, sweet, or bold.</span>
                        </button>
                        <button
                          type="button"
                          className="choice-card dare-choice"
                          onClick={() => void drawOnlineTruthOrDareCard('Dare')}
                          disabled={currentOnlinePlayerIndex !== onlineTruthOrDare.currentPlayer}
                        >
                          <strong>Dare</strong>
                          <span>Do something playful, flirty, or ridiculous.</span>
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {onlineTruthOrDare.phase === 'card' && onlineTruthOrDare.activeCard ? (
                    <div className="online-stack">
                      <h3>{onlineTruthOrDare.activeCard.kind}</h3>
                      <p className="prompt-text">{onlineTruthOrDare.activeCard.prompt}</p>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={completeOnlineTruthOrDareCard}
                        disabled={currentOnlinePlayerIndex !== onlineTruthOrDare.currentPlayer}
                      >
                        Completed
                      </button>
                    </div>
                  ) : null}
                  {onlineTruthOrDare.phase === 'result' ? (
                    <div className="online-stack">
                      <ResultStage winner={onlineTruthOrDare.winner} colors={onlineSession.colors} />
                      <h3>
                        {onlineTruthOrDare.winner === 'both'
                          ? 'Online Truth or Dare ends tied'
                          : `${onlinePlayerName(onlineTruthOrDare.winner as PlayerIndex)} wins Online Truth or Dare`}
                      </h3>
                      <p className="panel-note">{onlineTruthOrDare.resultSummary}</p>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={startOnlineTruthOrDare}
                        disabled={onlineBusyAction !== null}
                      >
                        {onlineBusyAction === 'start' ? 'Restarting...' : 'Play Again'}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}

              {onlineSession.roomState.activeGame === 'never-have-i-ever' && onlineNeverHaveI ? (
                <>
                  <p className="turn-tag">Online Never Have I Ever</p>
                  {onlineNeverHaveI.cue ? (
                    <FeedbackScene
                      cue={onlineNeverHaveI.cue}
                      speakerName={onlinePlayerName(onlineNeverHaveI.cue.speaker)}
                      speakerColor={onlineSession.colors[onlineNeverHaveI.cue.speaker]}
                    />
                  ) : null}
                  <div className="scoreboard-row">
                    <div className="score-chip">
                      <strong>Round {onlineNeverHaveI.round}</strong>
                      <span>of {onlineNeverHaveI.totalRounds}</span>
                    </div>
                    <div className="score-chip">
                      <strong>Shared score</strong>
                      <span>{onlineNeverHaveI.sharedScore}</span>
                    </div>
                  </div>
                  {onlineNeverHaveI.phase === 'intro' ? (
                    <div className="online-stack">
                      <p className="prompt-text">{onlineNeverHaveI.currentPrompt}</p>
                      <button type="button" className="primary-button" onClick={beginOnlineNeverHaveI}>
                        Start Answers
                      </button>
                    </div>
                  ) : null}
                  {onlineNeverHaveI.phase === 'answer' && currentOnlinePlayerIndex !== null ? (
                    <div className="online-stack">
                      <h3>{onlineNeverHaveI.currentPrompt}</h3>
                      <div className="truth-choice-grid">
                        <button
                          type="button"
                          className="choice-card truth-choice"
                          onClick={() => void answerOnlineNeverHaveI(true)}
                          disabled={onlineNeverHaveI.answers[currentOnlinePlayerIndex] !== null}
                        >
                          <strong>I have</strong>
                          <span>That one applies to me.</span>
                        </button>
                        <button
                          type="button"
                          className="choice-card dare-choice"
                          onClick={() => void answerOnlineNeverHaveI(false)}
                          disabled={onlineNeverHaveI.answers[currentOnlinePlayerIndex] !== null}
                        >
                          <strong>Never</strong>
                          <span>Nope, not me.</span>
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {onlineNeverHaveI.phase === 'reveal' ? (
                    <div className="online-stack game-stage-3d">
                      <div className="scoreboard-row">
                        <div className="score-chip">
                          <strong>{onlinePlayerName(0)}</strong>
                          <span>{onlineNeverHaveI.answers[0] ? 'I have' : 'Never'}</span>
                        </div>
                        <div className="score-chip">
                          <strong>{onlinePlayerName(1)}</strong>
                          <span>{onlineNeverHaveI.answers[1] ? 'I have' : 'Never'}</span>
                        </div>
                      </div>
                      <button type="button" className="primary-button" onClick={advanceOnlineNeverHaveI}>
                        Next Prompt
                      </button>
                    </div>
                  ) : null}
                  {onlineNeverHaveI.phase === 'result' ? (
                    <div className="online-stack">
                      <ResultStage winner="both" colors={onlineSession.colors} />
                      <h3>Online Never Have I Ever complete</h3>
                      <p className="panel-note">{onlineNeverHaveI.resultSummary}</p>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={startOnlineNeverHaveI}
                        disabled={onlineBusyAction !== null}
                      >
                        {onlineBusyAction === 'start' ? 'Restarting...' : 'Play Again'}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}

              {onlineSession.roomState.activeGame === 'celebrity-guess' && onlineCelebrityGuess ? (
                <>
                  <p className="turn-tag">Online Celebrity Guess</p>
                  {onlineCelebrityGuess.cue ? (
                    <FeedbackScene
                      cue={onlineCelebrityGuess.cue}
                      speakerName={onlinePlayerName(onlineCelebrityGuess.cue.speaker)}
                      speakerColor={onlineSession.colors[onlineCelebrityGuess.cue.speaker]}
                    />
                  ) : null}
                  {onlineCelebrityGuess.phase === 'secret' ? (
                    <div className="online-stack">
                      <h3>Choose the celebrity</h3>
                      <div className="chip-grid">
                        {CELEBRITY_OPTIONS.map((celebrity) => (
                          <button
                            key={celebrity}
                            type="button"
                            className="chip-button"
                            onClick={() => void chooseOnlineCelebrity(celebrity)}
                            disabled={currentOnlinePlayerIndex !== onlineCelebrityGuess.chooser}
                          >
                            {celebrity}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {onlineCelebrityGuess.phase === 'questions' ? (
                    <div className="online-stack">
                      <div className="scoreboard-row">
                        <div className="score-chip">
                          <strong>Questions used</strong>
                          <span>{onlineCelebrityGuess.questionCount} / {onlineCelebrityGuess.maxQuestions}</span>
                        </div>
                      </div>
                      <div className="chip-grid">
                        {CELEBRITY_QUESTIONS.map((question) => (
                          <button
                            key={question}
                            type="button"
                            className={`chip-button ${onlineCelebrityGuess.pendingQuestion === question ? 'selected-chip' : ''}`}
                            onClick={() => void pickOnlineCelebrityQuestion(question)}
                            disabled={currentOnlinePlayerIndex !== onlineCelebrityGuess.guesser}
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                      {onlineCelebrityGuess.pendingQuestion ? (
                        <div className="answer-strip">
                          <p>{onlineCelebrityGuess.pendingQuestion}</p>
                          <div className="card-actions">
                            {(['Yes', 'No', 'Maybe'] as CelebrityAnswer[]).map((answer) => (
                              <button
                                key={answer}
                                type="button"
                                className="ghost-button"
                                onClick={() => void answerOnlineCelebrityQuestion(answer)}
                                disabled={currentOnlinePlayerIndex !== onlineCelebrityGuess.chooser}
                              >
                                {answer}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <form className="duel-form" onSubmit={submitOnlineCelebrityGuess}>
                        <input
                          type="text"
                          placeholder="Your celebrity guess"
                          value={celebGuessDraft}
                          onChange={(event) => setCelebGuessDraft(event.target.value)}
                          disabled={currentOnlinePlayerIndex !== onlineCelebrityGuess.guesser}
                        />
                        <button
                          type="submit"
                          className="primary-button"
                          disabled={currentOnlinePlayerIndex !== onlineCelebrityGuess.guesser}
                        >
                          Submit Guess
                        </button>
                      </form>
                    </div>
                  ) : null}
                  {onlineCelebrityGuess.phase === 'result' && onlineCelebrityGuess.winner !== null ? (
                    <div className="online-stack">
                      <ResultStage winner={onlineCelebrityGuess.winner} colors={onlineSession.colors} />
                      <h3>{onlinePlayerName(onlineCelebrityGuess.winner)} wins Online Celebrity Guess</h3>
                      <p className="panel-note">{onlineCelebrityGuess.resultSummary}</p>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={startOnlineCelebrityGuess}
                        disabled={onlineBusyAction !== null}
                      >
                        {onlineBusyAction === 'start' ? 'Restarting...' : 'Play Again'}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}

              {onlineSession.roomState.activeGame === 'hangman' && onlineHangman ? (
                <>
                  <p className="turn-tag">Online Hangman</p>
                  {onlineHangman.cue ? (
                    <FeedbackScene
                      cue={onlineHangman.cue}
                      speakerName={onlinePlayerName(onlineHangman.cue.speaker)}
                      speakerColor={onlineSession.colors[onlineHangman.cue.speaker]}
                    />
                  ) : null}
                  {onlineHangman.phase === 'secret' ? (
                    <div className="online-stack">
                      <div className="scoreboard-row">
                        <div className="score-chip">
                          <strong>Round</strong>
                          <span>{onlineHangman.round} / {onlineHangman.totalRounds}</span>
                        </div>
                        <div className="score-chip">
                          <strong>{onlinePlayerName(0)}</strong>
                          <span>{onlineHangman.scores[0]} pts</span>
                        </div>
                        <div className="score-chip">
                          <strong>{onlinePlayerName(1)}</strong>
                          <span>{onlineHangman.scores[1]} pts</span>
                        </div>
                      </div>
                      <h3>Choose the hidden word</h3>
                      <form className="duel-form depth-card" onSubmit={lockOnlineHangmanWord}>
                        <input
                          type="password"
                          placeholder="Secret word"
                          value={hangmanWordDraft}
                          onChange={(event) => setHangmanWordDraft(event.target.value)}
                          disabled={currentOnlinePlayerIndex !== onlineHangman.setter}
                        />
                        <button
                          type="submit"
                          className="primary-button"
                          disabled={currentOnlinePlayerIndex !== onlineHangman.setter}
                        >
                          Lock Word
                        </button>
                      </form>
                    </div>
                  ) : null}
                  {onlineHangman.phase === 'guess' ? (
                    <div className="online-stack game-stage-3d">
                      <div className="scoreboard-row">
                        <div className="score-chip">
                          <strong>Round</strong>
                          <span>{onlineHangman.round} / {onlineHangman.totalRounds}</span>
                        </div>
                        <div className="score-chip">
                          <strong>{onlinePlayerName(0)}</strong>
                          <span>{onlineHangman.scores[0]} pts</span>
                        </div>
                        <div className="score-chip">
                          <strong>{onlinePlayerName(1)}</strong>
                          <span>{onlineHangman.scores[1]} pts</span>
                        </div>
                      </div>
                      <div className="hangman-scene">
                        <div className={`hangman-stage stage-${onlineHangman.wrongLetters.length} cinematic-stage`}>
                          <div className="scene-glow scene-glow-left"></div>
                          <div className="scene-glow scene-glow-right"></div>
                          <div className="rope-shine"></div>
                          <div className="gallows-base"></div>
                          <div className="gallows-pole"></div>
                          <div className="gallows-beam"></div>
                          <div className="gallows-rope"></div>
                          <div className="hanger">
                            <div className="hanger-head"></div>
                            <div className="hanger-body"></div>
                            <div className="hanger-arm arm-left"></div>
                            <div className="hanger-arm arm-right"></div>
                            <div className="hanger-leg leg-left"></div>
                            <div className="hanger-leg leg-right"></div>
                          </div>
                          <div className="panic-particles">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                        </div>
                        <div className="hangman-bubble depth-card">
                          <strong>Rescue scene</strong>
                          <p>
                            {onlineHangman.wrongLetters.length === 0
                              ? 'The rope is still calm. Start with a strong first guess.'
                              : onlineHangman.wrongLetters.length < 3
                                ? 'The stage is wobbling. Keep the rescue on track.'
                                : onlineHangman.wrongLetters.length < 6
                                  ? 'The drama meter is climbing. One smart letter can swing it back.'
                                  : 'Maximum chaos reached. The scene is fully panicking.'}
                          </p>
                        </div>
                      </div>
                      <h3 className="hangman-mask">{maskHangmanWord(onlineHangman.word, onlineHangman.guessedLetters)}</h3>
                      <div className="scoreboard-row">
                        <div className="score-chip">
                          <strong>Wrong letters</strong>
                          <span>{onlineHangman.wrongLetters.join(', ') || 'None yet'}</span>
                        </div>
                        <div className="score-chip">
                          <strong>Misses left</strong>
                          <span>{6 - onlineHangman.wrongLetters.length}</span>
                        </div>
                      </div>
                      <form className="duel-form" onSubmit={submitOnlineHangmanGuess}>
                        <input
                          type="text"
                          maxLength={1}
                          placeholder="Guess a letter"
                          value={hangmanLetterDraft}
                          onChange={(event) =>
                            setHangmanLetterDraft(event.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 1))
                          }
                          disabled={currentOnlinePlayerIndex !== onlineHangman.guesser}
                        />
                        <button
                          type="submit"
                          className="primary-button"
                          disabled={currentOnlinePlayerIndex !== onlineHangman.guesser}
                        >
                          Guess Letter
                        </button>
                      </form>
                    </div>
                  ) : null}
                  {onlineHangman.phase === 'result' && onlineHangman.winner !== null ? (
                    <div className="online-stack">
                      <ResultStage winner={onlineHangman.winner} colors={onlineSession.colors} />
                      <h3>
                        {onlineHangman.winner === 'draw'
                          ? 'Online Hangman ends in a draw'
                          : `${onlinePlayerName(onlineHangman.winner as PlayerIndex)} wins Online Hangman`}
                      </h3>
                      <p className="panel-note">{onlineHangman.resultSummary}</p>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={startOnlineHangman}
                        disabled={onlineBusyAction !== null}
                      >
                        {onlineBusyAction === 'start' ? 'Restarting...' : 'Play Again'}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}

              {onlineSession.roomState.activeGame === 'dots-boxes' && onlineDotsBoxes ? (
                <>
                  <p className="turn-tag">Online Dots and Boxes</p>
                  {onlineDotsBoxes.cue ? (
                    <FeedbackScene
                      cue={onlineDotsBoxes.cue}
                      speakerName={onlinePlayerName(onlineDotsBoxes.cue.speaker)}
                      speakerColor={onlineSession.colors[onlineDotsBoxes.cue.speaker]}
                    />
                  ) : null}
                  {onlineDotsBoxes.phase === 'play' ? (
                    <div className="online-stack">
                      <div className="scoreboard-row">
                        <div className="score-chip">
                          <strong>{onlinePlayerName(0)}</strong>
                          <span>{onlineDotsBoxes.scores[0]} boxes</span>
                        </div>
                        <div className="score-chip">
                          <strong>{onlinePlayerName(1)}</strong>
                          <span>{onlineDotsBoxes.scores[1]} boxes</span>
                        </div>
                      </div>
                      <h3>
                        {currentOnlinePlayerIndex === onlineDotsBoxes.currentTurn
                          ? 'Your line'
                          : `${onlinePlayerName(onlineDotsBoxes.currentTurn)} is drawing`}
                      </h3>
                      <div
                        className="dots-board"
                        style={{
                          gridTemplateColumns: `repeat(${DOTS_SIZE * 2 + 1}, 1fr)`,
                          gridTemplateRows: `repeat(${DOTS_SIZE * 2 + 1}, 1fr)`,
                        }}
                      >
                        {Array.from({ length: DOTS_SIZE * 2 + 1 }, (_, row) =>
                          Array.from({ length: DOTS_SIZE * 2 + 1 }, (_, col) => {
                            if (row % 2 === 0 && col % 2 === 0) {
                              return <div key={`${row}-${col}`} className="dot-node"></div>
                            }

                            if (row % 2 === 0 && col % 2 === 1) {
                              const key = edgeKeyHorizontal(row / 2, Math.floor(col / 2))
                              const owner = onlineDotsBoxes.lines[key]
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  className={`line-button horizontal ${owner !== undefined ? `owned-${owner}` : ''}`}
                                  onClick={() => void playOnlineDotsLine(key)}
                                  disabled={owner !== undefined || currentOnlinePlayerIndex !== onlineDotsBoxes.currentTurn}
                                />
                              )
                            }

                            if (row % 2 === 1 && col % 2 === 0) {
                              const key = edgeKeyVertical(Math.floor(row / 2), col / 2)
                              const owner = onlineDotsBoxes.lines[key]
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  className={`line-button vertical ${owner !== undefined ? `owned-${owner}` : ''}`}
                                  onClick={() => void playOnlineDotsLine(key)}
                                  disabled={owner !== undefined || currentOnlinePlayerIndex !== onlineDotsBoxes.currentTurn}
                                />
                              )
                            }

                            const boxIndex = Math.floor(row / 2) * DOTS_SIZE + Math.floor(col / 2)
                            const owner = onlineDotsBoxes.boxes[boxIndex]
                            return (
                              <div
                                key={`box-${boxIndex}`}
                                className={`box-cell ${owner !== null ? `box-owned-${owner}` : ''}`}
                              >
                                {owner === 0 ? onlinePlayerName(0).slice(0, 1) : owner === 1 ? onlinePlayerName(1).slice(0, 1) : ''}
                              </div>
                            )
                          }),
                        )}
                      </div>
                    </div>
                  ) : null}
                  {onlineDotsBoxes.phase === 'result' ? (
                    <div className="online-stack">
                      <ResultStage winner={onlineDotsBoxes.winner} colors={onlineSession.colors} />
                      <h3>
                        {onlineDotsBoxes.winner === 'draw'
                          ? 'Online Dots and Boxes ends in a draw'
                          : `${onlinePlayerName(onlineDotsBoxes.winner as PlayerIndex)} wins Online Dots and Boxes`}
                      </h3>
                      <p className="panel-note">{onlineDotsBoxes.resultSummary}</p>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={startOnlineDotsBoxes}
                        disabled={onlineBusyAction !== null}
                      >
                        {onlineBusyAction === 'start' ? 'Restarting...' : 'Play Again'}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}
            </article>
          </div>
        </section>
      ) : null}

      {screen === 'number-duel' && numberDuel ? (
        <section className="panel duel-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Number Duel</p>
              <h2>Pass-and-play guessing battle</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => setScreen('home')}>
              Back to Hub
            </button>
          </div>

          {numberDuel.view === 'secret' ? (
            <div className="turn-card">
              <p className="turn-tag">{currentPlayerName(numberDuel.currentPlayer)} sets a secret</p>
              <h3>Pick a number from 1 to 999</h3>
              <p className="panel-note">Keep it hidden. The next screen will prompt you to pass the device.</p>
              <form className="duel-form" onSubmit={lockSecretNumber}>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={3}
                  placeholder="Hidden number"
                  value={secretDraft}
                  onChange={(event) =>
                    setSecretDraft(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))
                  }
                />
                <button type="submit" className="primary-button">
                  Lock It In
                </button>
              </form>
            </div>
          ) : null}

          {numberDuel.view === 'pass' ? (
            <div className="turn-card pass-card">
              <p className="turn-tag">Privacy screen</p>
              <h3>{numberDuel.passTitle}</h3>
              <p className="panel-note">{numberDuel.passNote}</p>
              <button type="button" className="primary-button" onClick={moveFromNumberPass}>
                Reveal Next Turn
              </button>
            </div>
          ) : null}

          {numberDuel.view === 'reveal' && numberRevealCue ? (
            <div className="turn-card reveal-card">
              <p className="turn-tag">Clue revealed</p>
              <FeedbackScene
                cue={numberRevealCue}
                speakerName={currentPlayerName(numberRevealCue.speaker)}
                speakerColor={profile.playerColors[numberRevealCue.speaker]}
              />
              <p className="panel-note">
                {currentPlayerName(numberDuel.currentPlayer)} saw the clue. Now pass the screen to{' '}
                {currentPlayerName(partnerOf(numberDuel.currentPlayer))}.
              </p>
              <button type="button" className="primary-button" onClick={moveFromNumberReveal}>
                Pass to {currentPlayerName(partnerOf(numberDuel.currentPlayer))}
              </button>
            </div>
          ) : null}

          {numberDuel.view === 'guess' && activeNumberTracker ? (
            <div className="duel-layout">
              <div className="turn-card">
                <p className="turn-tag">{currentPlayerName(numberDuel.currentPlayer)} is guessing</p>
                <h3>Find your partner&apos;s hidden number</h3>
                <p className="panel-note">
                  Your current range is <strong>{activeNumberTracker.min}</strong> to <strong>{activeNumberTracker.max}</strong>.
                </p>
                <form className="duel-form" onSubmit={submitNumberGuess}>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder={`${activeNumberTracker.min}-${activeNumberTracker.max}`}
                    value={guessDraft}
                    onChange={(event) =>
                      setGuessDraft(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))
                    }
                  />
                  <button type="submit" className="primary-button">
                    Submit Guess
                  </button>
                </form>
                <p className="status-line">{numberDuel.statusMessage}</p>
              </div>

              <div className="tracker-grid">
                {([0, 1] as PlayerIndex[]).map((playerIndex) => {
                  const tracker = numberDuel.trackers[playerIndex]
                  const isActive = playerIndex === numberDuel.currentPlayer

                  return (
                    <article key={playerIndex} className={`tracker-card ${isActive ? 'active' : ''}`}>
                      <p>{currentPlayerName(playerIndex)}</p>
                      <strong>{tracker?.attempts ?? 0} attempts</strong>
                      <span>
                        Range: {tracker?.min ?? 1} - {tracker?.max ?? 999}
                      </span>
                      <ul>
                        {(tracker?.recentHints ?? []).map((hint) => (
                          <li key={hint}>{hint}</li>
                        ))}
                      </ul>
                    </article>
                  )
                })}
              </div>
            </div>
          ) : null}

          {numberDuel.view === 'result' && numberDuel.winner !== null ? (
            <div className="turn-card result-card">
              <p className="turn-tag">Round complete</p>
              <ResultStage winner={numberDuel.winner} colors={profile.playerColors} />
              <h3>{currentPlayerName(numberDuel.winner)} wins the duel</h3>
              <p className="panel-note">{numberDuel.statusMessage}</p>
              <div className="result-actions">
                <button type="button" className="primary-button" onClick={startNumberDuel}>
                  Play Again
                </button>
                <button type="button" className="ghost-button" onClick={() => setScreen('home')}>
                  Back to Hub
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {screen === 'mine-matrix' && mineMatrix ? (
        <section className="panel duel-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Mine Matrix</p>
              <h2>Plant three mines. Avoid three strikes.</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => setScreen('home')}>
              Back to Hub
            </button>
          </div>

          {(mineMatrix.view === 'plant' || mineMatrix.view === 'play') && mineCue ? (
            <FeedbackScene
              cue={mineCue}
              speakerName={currentPlayerName(mineCue.speaker)}
              speakerColor={profile.playerColors[mineCue.speaker]}
            />
          ) : null}

          {mineMatrix.view === 'plant' ? (
            <div className="turn-card">
              <p className="turn-tag">{currentPlayerName(mineMatrix.currentPlayer)} plants mines</p>
              <h3>Select 3 hidden mines on your board</h3>
              <p className="panel-note">Your partner will try to bite from this tray later.</p>
              <div className="mine-grid">
                {GRID_CELLS.map((cell) => {
                  const selected = includesCell(
                    mineMatrix.plantingSelections[mineMatrix.currentPlayer],
                    cell,
                  )

                  return (
                    <button
                      key={cell}
                      type="button"
                      className={`mine-cell ${selected ? 'selected' : ''}`}
                      onClick={() => toggleMineSelection(cell)}
                    >
                      {selected ? MINE_ICON : ''}
                    </button>
                  )
                })}
              </div>
              <p className="panel-note">
                {mineMatrix.plantingSelections[mineMatrix.currentPlayer].length} of 3 mines selected.
              </p>
              <button type="button" className="primary-button" onClick={confirmMinePlacement}>
                Lock Mine Layout
              </button>
            </div>
          ) : null}

          {mineMatrix.view === 'pass' ? (
            <div className="turn-card pass-card">
              <p className="turn-tag">Privacy screen</p>
              <h3>{mineMatrix.passTitle}</h3>
              <p className="panel-note">{mineMatrix.passNote}</p>
              <button type="button" className="primary-button" onClick={moveFromMinePass}>
                Reveal Next Turn
              </button>
            </div>
          ) : null}

          {mineMatrix.view === 'play' ? (
            <div className="turn-card">
              <p className="turn-tag">{currentPlayerName(mineMatrix.currentPlayer)} is choosing</p>
              <h3>Pick a bite from {currentPlayerName(partnerOf(mineMatrix.currentPlayer))}&apos;s tray</h3>
              <div className="scoreboard-row">
                <div className="score-chip">
                  <strong>{currentPlayerName(0)}</strong>
                  <span>{mineMatrix.mineHits[0]} strikes</span>
                </div>
                <div className="score-chip">
                  <strong>{currentPlayerName(1)}</strong>
                  <span>{mineMatrix.mineHits[1]} strikes</span>
                </div>
              </div>
              <div className="mine-grid">
                {GRID_CELLS.map((cell) => {
                  const defender = partnerOf(mineMatrix.currentPlayer)
                  const revealed = includesCell(mineMatrix.revealedBoards[defender], cell)
                  const isMine = includesCell(mineMatrix.mineBoards[defender], cell)

                  return (
                    <button
                      key={cell}
                      type="button"
                      className={`mine-cell ${revealed ? (isMine ? 'mine-hit' : 'safe-hit') : ''}`}
                      onClick={() => revealMineCell(cell)}
                      disabled={revealed}
                    >
                      {revealed ? (isMine ? MINE_ICON : SAFE_ICON) : '?'}
                    </button>
                  )
                })}
              </div>
              <p className="status-line">{mineMatrix.statusMessage}</p>
            </div>
          ) : null}

          {mineMatrix.view === 'result' && mineMatrix.winner !== null ? (
            <div className="turn-card result-card">
              <p className="turn-tag">Round complete</p>
              <ResultStage winner={mineMatrix.winner} colors={profile.playerColors} />
              <h3>{currentPlayerName(mineMatrix.winner)} wins Mine Matrix</h3>
              <p className="panel-note">{mineMatrix.statusMessage}</p>
              <div className="scoreboard-row result-scoreboard">
                <div className="score-chip">
                  <strong>{currentPlayerName(0)}</strong>
                  <span>{mineMatrix.mineHits[0]} strikes</span>
                </div>
                <div className="score-chip">
                  <strong>{currentPlayerName(1)}</strong>
                  <span>{mineMatrix.mineHits[1]} strikes</span>
                </div>
              </div>
              <div className="result-actions">
                <button type="button" className="primary-button" onClick={startMineMatrix}>
                  Play Again
                </button>
                <button type="button" className="ghost-button" onClick={() => setScreen('home')}>
                  Back to Hub
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {screen === 'truth-dare' && truthOrDare ? (
        <section className="panel duel-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Truth or Dare</p>
              <h2>Alternate prompts and collect playful session points</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => setScreen('home')}>
              Back to Hub
            </button>
          </div>

          {truthCue ? (
            <FeedbackScene
              cue={truthCue}
              speakerName={currentPlayerName(truthCue.speaker)}
              speakerColor={profile.playerColors[truthCue.speaker]}
            />
          ) : null}

          <div className="scoreboard-row">
            <div className="score-chip">
              <strong>{currentPlayerName(0)}</strong>
              <span>{truthOrDare.scores[0]} cards completed</span>
            </div>
            <div className="score-chip">
              <strong>Round {truthOrDare.round}</strong>
              <span>of {truthOrDare.totalRounds}</span>
            </div>
            <div className="score-chip">
              <strong>{currentPlayerName(1)}</strong>
              <span>{truthOrDare.scores[1]} cards completed</span>
            </div>
          </div>

          {truthOrDare.view === 'choose' ? (
            <div className="turn-card">
              <p className="turn-tag">{currentPlayerName(truthOrDare.currentPlayer)} chooses</p>
              <h3>Truth or Dare?</h3>
              <div className="truth-choice-grid">
                <button type="button" className="choice-card truth-choice" onClick={() => drawTruthOrDareCard('Truth')}>
                  <strong>Truth</strong>
                  <span>Share something real, sweet, or a little bold.</span>
                </button>
                <button type="button" className="choice-card dare-choice" onClick={() => drawTruthOrDareCard('Dare')}>
                  <strong>Dare</strong>
                  <span>Do something playful, flirty, or gently ridiculous.</span>
                </button>
              </div>
            </div>
          ) : null}

          {truthOrDare.view === 'card' && truthOrDare.activeCard ? (
            <div className="turn-card prompt-card">
              <p className="turn-tag">{currentPlayerName(truthOrDare.currentPlayer)} drew a card</p>
              <h3 className={`prompt-kind prompt-${truthOrDare.activeCard.kind.toLowerCase()}`}>
                {truthOrDare.activeCard.kind}
              </h3>
              <p className="prompt-text">{truthOrDare.activeCard.prompt}</p>
              <div className="card-actions">
                <button type="button" className="primary-button" onClick={completeTruthOrDareCard}>
                  Completed
                </button>
                <button type="button" className="ghost-button" onClick={redrawTruthOrDareCard}>
                  Draw Another
                </button>
              </div>
            </div>
          ) : null}

          {truthOrDare.view === 'pass' ? (
            <div className="turn-card pass-card">
              <p className="turn-tag">Pass the screen</p>
              <h3>{truthOrDare.passTitle}</h3>
              <p className="panel-note">{truthOrDare.passNote}</p>
              <button type="button" className="primary-button" onClick={moveFromTruthPass}>
                Reveal Next Turn
              </button>
            </div>
          ) : null}

          {truthOrDare.view === 'result' ? (
            <div className="turn-card result-card">
              <p className="turn-tag">Session complete</p>
              <ResultStage winner={truthOrDare.winner} colors={profile.playerColors} />
              <h3>
                {truthOrDare.winner === 'both'
                  ? 'Both of you win the vibe round'
                  : `${currentPlayerName(truthOrDare.winner as PlayerIndex)} wins Truth or Dare`}
              </h3>
              <p className="panel-note">{truthOrDare.resultSummary}</p>
              <div className="result-actions">
                <button type="button" className="primary-button" onClick={startTruthOrDare}>
                  Play Again
                </button>
                <button type="button" className="ghost-button" onClick={() => setScreen('home')}>
                  Back to Hub
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {screen === 'never-have-i-ever' && neverHaveI ? (
        <section className="panel duel-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Never Have I Ever</p>
              <h2>Reveal how matched your stories really are</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => setScreen('home')}>
              Back to Hub
            </button>
          </div>

          {neverCue ? (
            <FeedbackScene
              cue={neverCue}
              speakerName={currentPlayerName(neverCue.speaker)}
              speakerColor={profile.playerColors[neverCue.speaker]}
            />
          ) : null}

          <div className="scoreboard-row">
            <div className="score-chip">
              <strong>Round {neverHaveI.round}</strong>
              <span>of {neverHaveI.totalRounds}</span>
            </div>
            <div className="score-chip">
              <strong>Shared score</strong>
              <span>{neverHaveI.sharedScore}</span>
            </div>
          </div>

          {neverHaveI.view === 'intro' ? (
            <div className="turn-card prompt-card">
              <p className="turn-tag">Prompt</p>
              <p className="prompt-text">{neverHaveI.currentPrompt}</p>
              <button type="button" className="primary-button" onClick={beginNeverHaveIRound}>
                Start Answers
              </button>
            </div>
          ) : null}

          {neverHaveI.view === 'answer' ? (
            <div className="turn-card">
              <p className="turn-tag">{currentPlayerName(neverHaveI.currentPlayer)} answers privately</p>
              <h3>{neverHaveI.currentPrompt}</h3>
              <div className="truth-choice-grid">
                <button type="button" className="choice-card truth-choice" onClick={() => answerNeverHaveI(true)}>
                  <strong>I have</strong>
                  <span>That one applies to me.</span>
                </button>
                <button type="button" className="choice-card dare-choice" onClick={() => answerNeverHaveI(false)}>
                  <strong>Never</strong>
                  <span>Nope, not me.</span>
                </button>
              </div>
            </div>
          ) : null}

          {neverHaveI.view === 'pass' ? (
            <div className="turn-card pass-card">
              <p className="turn-tag">Pass the screen</p>
              <h3>{neverHaveI.passTitle}</h3>
              <p className="panel-note">{neverHaveI.passNote}</p>
              <button type="button" className="primary-button" onClick={moveFromNeverHaveIPass}>
                Reveal Next Turn
              </button>
            </div>
          ) : null}

          {neverHaveI.view === 'reveal' ? (
            <div className="turn-card result-card">
              <p className="turn-tag">Reveal</p>
              <div className="scoreboard-row">
                <div className="score-chip">
                  <strong>{currentPlayerName(0)}</strong>
                  <span>{neverHaveI.answers[0] ? 'I have' : 'Never'}</span>
                </div>
                <div className="score-chip">
                  <strong>{currentPlayerName(1)}</strong>
                  <span>{neverHaveI.answers[1] ? 'I have' : 'Never'}</span>
                </div>
              </div>
              <button type="button" className="primary-button" onClick={advanceNeverHaveI}>
                Next Prompt
              </button>
            </div>
          ) : null}

          {neverHaveI.view === 'result' ? (
            <div className="turn-card result-card">
              <p className="turn-tag">Session complete</p>
              <ResultStage winner="both" colors={profile.playerColors} />
              <h3>Never Have I Ever complete</h3>
              <p className="panel-note">{neverHaveI.resultSummary}</p>
              <div className="result-actions">
                <button type="button" className="primary-button" onClick={startNeverHaveI}>
                  Play Again
                </button>
                <button type="button" className="ghost-button" onClick={() => setScreen('home')}>
                  Back to Hub
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {screen === 'celebrity-guess' && celebrityGuess ? (
        <section className="panel duel-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Celebrity Guess</p>
              <h2>Pick a star. Answer questions. See if they can crack it.</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => setScreen('home')}>
              Back to Hub
            </button>
          </div>

          {celebrityCue ? (
            <FeedbackScene
              cue={celebrityCue}
              speakerName={currentPlayerName(celebrityCue.speaker)}
              speakerColor={profile.playerColors[celebrityCue.speaker]}
            />
          ) : null}

          {celebrityGuess.view === 'secret' ? (
            <div className="turn-card">
              <p className="turn-tag">{currentPlayerName(celebrityGuess.chooser)} chooses secretly</p>
              <h3>Pick the celebrity your partner must guess</h3>
              <div className="chip-grid">
                {CELEBRITY_OPTIONS.map((celebrity) => (
                  <button
                    key={celebrity}
                    type="button"
                    className="chip-button"
                    onClick={() => chooseSecretCelebrity(celebrity)}
                  >
                    {celebrity}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {celebrityGuess.view === 'pass' ? (
            <div className="turn-card pass-card">
              <p className="turn-tag">Privacy screen</p>
              <h3>{celebrityGuess.passTitle}</h3>
              <p className="panel-note">{celebrityGuess.passNote}</p>
              <button type="button" className="primary-button" onClick={moveFromCelebrityPass}>
                Reveal Next Turn
              </button>
            </div>
          ) : null}

          {celebrityGuess.view === 'questions' ? (
            <div className="duel-layout">
              <div className="turn-card">
                <p className="turn-tag">{currentPlayerName(celebrityGuess.guesser)} is guessing</p>
                <h3>Ask up to {celebrityGuess.maxQuestions} clue questions</h3>
                <div className="scoreboard-row">
                  <div className="score-chip">
                    <strong>Questions used</strong>
                    <span>{celebrityGuess.questionCount} / {celebrityGuess.maxQuestions}</span>
                  </div>
                </div>
                <div className="chip-grid">
                  {CELEBRITY_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      type="button"
                      className={`chip-button ${
                        celebrityGuess.pendingQuestion === question ? 'selected-chip' : ''
                      }`}
                      onClick={() => pickCelebrityQuestion(question)}
                    >
                      {question}
                    </button>
                  ))}
                </div>

                {celebrityGuess.pendingQuestion ? (
                  <div className="answer-strip">
                    <p>{celebrityGuess.pendingQuestion}</p>
                    <div className="card-actions">
                      {(['Yes', 'No', 'Maybe'] as CelebrityAnswer[]).map((answer) => (
                        <button
                          key={answer}
                          type="button"
                          className="ghost-button"
                          onClick={() => answerCelebrityQuestion(answer)}
                        >
                          {answer}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <form className="duel-form" onSubmit={submitCelebrityGuess}>
                  <input
                    type="text"
                    placeholder="Type your celebrity guess"
                    value={celebGuessDraft}
                    onChange={(event) => setCelebGuessDraft(event.target.value)}
                  />
                  <button type="submit" className="primary-button">
                    Submit Guess
                  </button>
                </form>
              </div>

              <div className="tracker-card">
                <p>Answer history</p>
                <ul>
                  {celebrityGuess.history.map((entry) => (
                    <li key={`${entry.question}-${entry.answer}`}>
                      {entry.question} - {entry.answer}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {celebrityGuess.view === 'result' && celebrityGuess.winner !== null ? (
            <div className="turn-card result-card">
              <p className="turn-tag">Round complete</p>
              <ResultStage winner={celebrityGuess.winner} colors={profile.playerColors} />
              <h3>{currentPlayerName(celebrityGuess.winner)} wins Celebrity Guess</h3>
              <p className="panel-note">{celebrityGuess.resultSummary}</p>
              <div className="result-actions">
                <button type="button" className="primary-button" onClick={startCelebrityGuess}>
                  Play Again
                </button>
                <button type="button" className="ghost-button" onClick={() => setScreen('home')}>
                  Back to Hub
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {screen === 'hangman' && hangman ? (
        <section className="panel duel-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Hangman</p>
              <h2>Hide a word and see if your partner can uncover it</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => setScreen('home')}>
              Back to Hub
            </button>
          </div>

          {hangmanCue ? (
            <FeedbackScene
              cue={hangmanCue}
              speakerName={currentPlayerName(hangmanCue.speaker)}
              speakerColor={profile.playerColors[hangmanCue.speaker]}
            />
          ) : null}

          {hangman.view === 'secret' ? (
            <div className="turn-card">
              <p className="turn-tag">{currentPlayerName(hangman.setter)} sets the word</p>
              <h3>Choose a secret word or short phrase</h3>
              <form className="duel-form" onSubmit={lockHangmanWord}>
                <input
                  type="password"
                  placeholder="Secret word"
                  value={hangmanWordDraft}
                  onChange={(event) => setHangmanWordDraft(event.target.value)}
                />
                <button type="submit" className="primary-button">
                  Lock Word
                </button>
              </form>
            </div>
          ) : null}

          {hangman.view === 'pass' ? (
            <div className="turn-card pass-card">
              <p className="turn-tag">Privacy screen</p>
              <h3>{hangman.passTitle}</h3>
              <p className="panel-note">{hangman.passNote}</p>
              <button type="button" className="primary-button" onClick={moveFromHangmanPass}>
                Reveal Next Turn
              </button>
            </div>
          ) : null}

          {hangman.view === 'guess' || hangman.view === 'result' ? (
            <div className="turn-card">
              <p className="turn-tag">
                {hangman.view === 'result'
                  ? 'Final scene'
                  : `${currentPlayerName(hangman.guesser)} is guessing`}
              </p>
              <div className="hangman-scene">
                <div className={`hangman-stage stage-${hangman.wrongLetters.length}`}>
                  <div className="gallows-base"></div>
                  <div className="gallows-pole"></div>
                  <div className="gallows-beam"></div>
                  <div className="gallows-rope"></div>
                  <div className="hanger">
                    <div className="hanger-head"></div>
                    <div className="hanger-body"></div>
                    <div className="hanger-arm arm-left"></div>
                    <div className="hanger-arm arm-right"></div>
                    <div className="hanger-leg leg-left"></div>
                    <div className="hanger-leg leg-right"></div>
                  </div>
                </div>

                {hangmanCue ? (
                  <div className="hangman-bubble">
                    <p className="feedback-speaker">{currentPlayerName(hangman.setter)} says</p>
                    <h3 className="feedback-text tone-warning">{hangmanCue.message}</h3>
                    <p className="feedback-support">{hangmanCue.support}</p>
                  </div>
                ) : null}
              </div>
              <h3 className="hangman-mask">{maskHangmanWord(hangman.word, hangman.guessedLetters)}</h3>
              <div className="scoreboard-row">
                <div className="score-chip">
                  <strong>Wrong letters</strong>
                  <span>{hangman.wrongLetters.join(', ') || 'None yet'}</span>
                </div>
                <div className="score-chip">
                  <strong>Misses left</strong>
                  <span>{6 - hangman.wrongLetters.length}</span>
                </div>
              </div>
              {hangman.view === 'guess' ? (
                <form className="duel-form" onSubmit={submitHangmanGuess}>
                  <input
                    type="text"
                    maxLength={1}
                    placeholder="Guess a letter"
                    value={hangmanLetterDraft}
                    onChange={(event) =>
                      setHangmanLetterDraft(event.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 1))
                    }
                  />
                  <button type="submit" className="primary-button">
                    Guess Letter
                  </button>
                </form>
              ) : null}

              {hangman.view === 'result' && hangman.winner !== null ? (
                <div className="inline-result">
                  <h3>{currentPlayerName(hangman.winner)} wins Hangman</h3>
                  <p className="panel-note">{hangman.resultSummary}</p>
                  <div className="result-actions">
                    <button type="button" className="primary-button" onClick={startHangman}>
                      Play Again
                    </button>
                    <button type="button" className="ghost-button" onClick={() => setScreen('home')}>
                      Back to Hub
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {screen === 'tic-tac-toe' && ticTacToe ? (
        <section className="panel duel-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Tic Tac Toe</p>
              <h2>Quick rivalry, same-screen classic</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => setScreen('home')}>
              Back to Hub
            </button>
          </div>

          {ticCue ? (
            <FeedbackScene
              cue={ticCue}
              speakerName={currentPlayerName(ticCue.speaker)}
              speakerColor={profile.playerColors[ticCue.speaker]}
            />
          ) : null}

          {ticTacToe.view === 'play' ? (
            <div className="turn-card">
              <p className="turn-tag">{currentPlayerName(ticTacToe.currentPlayer)} to move</p>
              <div className="tic-board">
                {ticTacToe.board.map((cell, index) => (
                  <button
                    key={index}
                    type="button"
                    className="tic-cell"
                    onClick={() => playTicTacToeMove(index)}
                    disabled={cell !== null}
                  >
                    {cell === 0 ? 'X' : cell === 1 ? 'O' : ''}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {ticTacToe.view === 'result' ? (
            <div className="turn-card result-card">
              <p className="turn-tag">Round complete</p>
              <ResultStage winner={ticTacToe.winner} colors={profile.playerColors} />
              <h3>
                {ticTacToe.winner === 'draw'
                  ? 'Tic Tac Toe ends in a draw'
                  : `${currentPlayerName(ticTacToe.winner as PlayerIndex)} wins Tic Tac Toe`}
              </h3>
              <p className="panel-note">{ticTacToe.resultSummary}</p>
              <div className="result-actions">
                <button type="button" className="primary-button" onClick={startTicTacToe}>
                  Play Again
                </button>
                <button type="button" className="ghost-button" onClick={() => setScreen('home')}>
                  Back to Hub
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {screen === 'dots-boxes' && dotsBoxes ? (
        <section className="panel duel-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Dots and Boxes</p>
              <h2>Draw lines, steal boxes, keep the turn when you score</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => setScreen('home')}>
              Back to Hub
            </button>
          </div>

          {dotsCue ? (
            <FeedbackScene
              cue={dotsCue}
              speakerName={currentPlayerName(dotsCue.speaker)}
              speakerColor={profile.playerColors[dotsCue.speaker]}
            />
          ) : null}

          {dotsBoxes.view === 'play' ? (
            <div className="turn-card">
              <p className="turn-tag">{currentPlayerName(dotsBoxes.currentPlayer)} is drawing</p>
              <div className="scoreboard-row">
                <div className="score-chip">
                  <strong>{currentPlayerName(0)}</strong>
                  <span>{dotsBoxes.scores[0]} boxes</span>
                </div>
                <div className="score-chip">
                  <strong>{currentPlayerName(1)}</strong>
                  <span>{dotsBoxes.scores[1]} boxes</span>
                </div>
              </div>
              <div
                className="dots-board"
                style={{
                  gridTemplateColumns: `repeat(${DOTS_SIZE * 2 + 1}, 1fr)`,
                  gridTemplateRows: `repeat(${DOTS_SIZE * 2 + 1}, 1fr)`,
                }}
              >
                {Array.from({ length: DOTS_SIZE * 2 + 1 }, (_, row) =>
                  Array.from({ length: DOTS_SIZE * 2 + 1 }, (_, col) => {
                    if (row % 2 === 0 && col % 2 === 0) {
                      return <div key={`${row}-${col}`} className="dot-node"></div>
                    }

                    if (row % 2 === 0 && col % 2 === 1) {
                      const key = edgeKeyHorizontal(row / 2, Math.floor(col / 2))
                      const owner = dotsBoxes.lines[key]
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`line-button horizontal ${owner !== undefined ? `owned-${owner}` : ''}`}
                          onClick={() => playDotsLine(key)}
                          disabled={owner !== undefined}
                        />
                      )
                    }

                    if (row % 2 === 1 && col % 2 === 0) {
                      const key = edgeKeyVertical(Math.floor(row / 2), col / 2)
                      const owner = dotsBoxes.lines[key]
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`line-button vertical ${owner !== undefined ? `owned-${owner}` : ''}`}
                          onClick={() => playDotsLine(key)}
                          disabled={owner !== undefined}
                        />
                      )
                    }

                    const boxIndex = Math.floor(row / 2) * DOTS_SIZE + Math.floor(col / 2)
                    const owner = dotsBoxes.boxes[boxIndex]
                    return (
                      <div
                        key={`box-${boxIndex}`}
                        className={`box-cell ${owner !== null ? `box-owned-${owner}` : ''}`}
                      >
                        {owner === 0 ? currentPlayerName(0).slice(0, 1) : owner === 1 ? currentPlayerName(1).slice(0, 1) : ''}
                      </div>
                    )
                  }),
                )}
              </div>
            </div>
          ) : null}

          {dotsBoxes.view === 'result' ? (
            <div className="turn-card result-card">
              <p className="turn-tag">Board complete</p>
              <ResultStage winner={dotsBoxes.winner} colors={profile.playerColors} />
              <h3>
                {dotsBoxes.winner === 'draw'
                  ? 'Dots and Boxes ends in a draw'
                  : `${currentPlayerName(dotsBoxes.winner as PlayerIndex)} wins Dots and Boxes`}
              </h3>
              <p className="panel-note">{dotsBoxes.resultSummary}</p>
              <div className="scoreboard-row result-scoreboard">
                <div className="score-chip">
                  <strong>{currentPlayerName(0)}</strong>
                  <span>{dotsBoxes.scores[0]} boxes</span>
                </div>
                <div className="score-chip">
                  <strong>{currentPlayerName(1)}</strong>
                  <span>{dotsBoxes.scores[1]} boxes</span>
                </div>
              </div>
              <div className="result-actions">
                <button type="button" className="primary-button" onClick={startDotsBoxes}>
                  Play Again
                </button>
                <button type="button" className="ghost-button" onClick={() => setScreen('home')}>
                  Back to Hub
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {screen === 'word-chain' && wordChain ? (
        <section className="panel duel-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Word Chain</p>
              <h2>Answer with a word that starts from the last letter</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => setScreen('home')}>
              Back to Hub
            </button>
          </div>

          {wordChainCue ? (
            <FeedbackScene
              cue={wordChainCue}
              speakerName={currentPlayerName(wordChainCue.speaker)}
              speakerColor={profile.playerColors[wordChainCue.speaker]}
            />
          ) : null}

          {wordChain.view === 'play' ? (
            <div className="duel-layout">
              <div className="turn-card">
                <p className="turn-tag">{currentPlayerName(wordChain.currentPlayer)} is up</p>
                <div className="scoreboard-row">
                  <div className="score-chip">
                    <strong>Starter letter</strong>
                    <span>{wordChain.requiredLetter}</span>
                  </div>
                  <div className="score-chip">
                    <strong>Chain length</strong>
                    <span>{wordChain.history.length} words</span>
                  </div>
                </div>
                <h3>Use a word that starts with {wordChain.requiredLetter}</h3>
                <p className="panel-note">{wordChain.statusMessage}</p>
                <form className="duel-form" onSubmit={submitWordChainWord}>
                  <input
                    type="text"
                    placeholder={`Word starting with ${wordChain.requiredLetter}`}
                    value={wordChainDraft}
                    onChange={(event) => setWordChainDraft(event.target.value)}
                    disabled={wordChain.validating}
                  />
                  {wordChain.error ? <p className="online-error">{wordChain.error}</p> : null}
                  <div className="result-actions">
                    <button type="submit" className="primary-button" disabled={wordChain.validating}>
                      {wordChain.validating ? 'Checking...' : 'Lock Word'}
                    </button>
                    <button type="button" className="ghost-button" onClick={giveUpWordChain} disabled={wordChain.validating}>
                      Give Up
                    </button>
                  </div>
                </form>
              </div>

              <div className="tracker-card">
                <p>Chain history</p>
                {wordChain.history.length > 0 ? (
                  <ul>
                    {wordChain.history
                      .slice()
                      .reverse()
                      .map((entry, index) => (
                        <li key={`${entry.word}-${index}`}>
                          {currentPlayerName(entry.player)}: {entry.word}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="panel-note">No words yet. The starter letter is waiting.</p>
                )}
              </div>
            </div>
          ) : null}

          {wordChain.view === 'result' && wordChain.winner !== null ? (
            <div className="turn-card result-card">
              <p className="turn-tag">Chain complete</p>
              <ResultStage winner={wordChain.winner} colors={profile.playerColors} />
              <h3>{currentPlayerName(wordChain.winner)} wins Word Chain</h3>
              <p className="panel-note">{wordChain.resultSummary}</p>
              <div className="scoreboard-row">
                <div className="score-chip">
                  <strong>Final chain</strong>
                  <span>{wordChain.history.length} words</span>
                </div>
              </div>
              <div className="result-actions">
                <button type="button" className="primary-button" onClick={startWordChain}>
                  Play Again
                </button>
                <button type="button" className="ghost-button" onClick={() => setScreen('home')}>
                  Back to Hub
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

export default App
