import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import './App.css'
import { isOnlinePlayConfigured } from './lib/online'

type PlayerIndex = 0 | 1
type Screen =
  | 'setup'
  | 'home'
  | 'number-duel'
  | 'mine-matrix'
  | 'truth-dare'
  | 'never-have-i-ever'
  | 'celebrity-guess'
  | 'hangman'
  | 'tic-tac-toe'
  | 'dots-boxes'
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

const STORAGE_KEY = 'couples-club-profile'
const DOTS_SIZE = 3
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

const getCharacterStyle = (color: string): CSSProperties =>
  ({
    '--character-color': color,
  }) as CSSProperties

const normalizeText = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

const includesCell = (cells: number[], cell: number) => cells.includes(cell)

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

  const [secretDraft, setSecretDraft] = useState('')
  const [guessDraft, setGuessDraft] = useState('')
  const [celebGuessDraft, setCelebGuessDraft] = useState('')
  const [hangmanWordDraft, setHangmanWordDraft] = useState('')
  const [hangmanLetterDraft, setHangmanLetterDraft] = useState('')

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  }, [profile])

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

  const openSetup = () => {
    setSetupNames([profile.players[0], profile.players[1]])
    setSetupColors([profile.playerColors[0], profile.playerColors[1]])
    setScreen('setup')
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

  const startGameFromHub = (key: (typeof PLAYABLE_GAMES)[number]['key']) => {
    switch (key) {
      case 'number-duel':
        startNumberDuel()
        return
      case 'mine-matrix':
        startMineMatrix()
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
        </section>
      ) : null}

      {screen === 'home' ? (
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

          <section className="dashboard-grid">
            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Online mode</p>
                  <h2>Room-code foundation</h2>
                </div>
                <p className={`status-pill ${onlinePlayReady ? 'ready' : 'pending'}`}>
                  {onlinePlayReady ? 'Configured' : 'Needs keys'}
                </p>
              </div>
              <p className="panel-note">
                This build is ready for free Vercel hosting with Supabase rooms and realtime sync.
                We can keep same-screen play live while adding online minigames one by one.
              </p>
              <div className="online-checklist">
                <article className="check-card">
                  <strong>Hosting</strong>
                  <span>Vercel-ready static Vite deploy with SPA rewrites.</span>
                </article>
                <article className="check-card">
                  <strong>Realtime rooms</strong>
                  <span>Supabase room storage, presence, and broadcast helpers are scaffolded.</span>
                </article>
                <article className="check-card">
                  <strong>Race game fit</strong>
                  <span>20-second mash races work well if we sync progress in short bursts.</span>
                </article>
              </div>
            </article>
          </section>
        </>
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
              <div className="dots-board">
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
    </div>
  )
}

export default App
