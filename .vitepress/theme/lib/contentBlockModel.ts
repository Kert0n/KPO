export type ContentBlockKind =
  | 'prose'
  | 'heading'
  | 'list'
  | 'blockquote'
  | 'custom-container'
  | 'table'
  | 'mermaid'
  | 'code'
  | 'multi-code'
  | 'playground'
  | 'image'
  | 'inline-risk'

export type ContentLane = 'prose' | 'wide' | 'embedded' | 'inline'

export type ContentOverflowOwner = 'none' | 'self' | 'child-viewport'

export type ContentCenterTarget = 'prose' | 'page' | 'container'

export type ContentBlockContract = {
  kind: ContentBlockKind
  lane: ContentLane
  canOverflow: boolean
  overflowOwner: ContentOverflowOwner
  centerAgainst: ContentCenterTarget
}

const contracts: Record<ContentBlockKind, ContentBlockContract> = {
  prose: {
    kind: 'prose',
    lane: 'prose',
    canOverflow: false,
    overflowOwner: 'none',
    centerAgainst: 'prose'
  },
  heading: {
    kind: 'heading',
    lane: 'prose',
    canOverflow: false,
    overflowOwner: 'none',
    centerAgainst: 'prose'
  },
  list: {
    kind: 'list',
    lane: 'prose',
    canOverflow: false,
    overflowOwner: 'none',
    centerAgainst: 'prose'
  },
  blockquote: {
    kind: 'blockquote',
    lane: 'prose',
    canOverflow: false,
    overflowOwner: 'none',
    centerAgainst: 'prose'
  },
  'custom-container': {
    kind: 'custom-container',
    lane: 'prose',
    canOverflow: false,
    overflowOwner: 'none',
    centerAgainst: 'prose'
  },
  table: {
    kind: 'table',
    lane: 'wide',
    canOverflow: true,
    overflowOwner: 'self',
    centerAgainst: 'page'
  },
  mermaid: {
    kind: 'mermaid',
    lane: 'wide',
    canOverflow: true,
    overflowOwner: 'child-viewport',
    centerAgainst: 'page'
  },
  code: {
    kind: 'code',
    lane: 'wide',
    canOverflow: true,
    overflowOwner: 'self',
    centerAgainst: 'page'
  },
  'multi-code': {
    kind: 'multi-code',
    lane: 'wide',
    canOverflow: true,
    overflowOwner: 'self',
    centerAgainst: 'page'
  },
  playground: {
    kind: 'playground',
    lane: 'embedded',
    canOverflow: true,
    overflowOwner: 'self',
    centerAgainst: 'page'
  },
  image: {
    kind: 'image',
    lane: 'wide',
    canOverflow: false,
    overflowOwner: 'none',
    centerAgainst: 'page'
  },
  'inline-risk': {
    kind: 'inline-risk',
    lane: 'inline',
    canOverflow: false,
    overflowOwner: 'none',
    centerAgainst: 'prose'
  }
}

export function getContentBlockContract(kind: ContentBlockKind): ContentBlockContract {
  return contracts[kind]
}

export function isWideContentBlock(kind: ContentBlockKind): boolean {
  return getContentBlockContract(kind).lane === 'wide'
}

export function ownsLocalOverflow(kind: ContentBlockKind): boolean {
  return getContentBlockContract(kind).overflowOwner !== 'none'
}
