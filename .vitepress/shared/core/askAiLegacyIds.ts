import { stableHash } from './hash'

type LegacyMultiCodeIdentity = {
  legacyId: string
  canonicalHash: string
}

const migratedDefaultKotlinIds: Record<string, LegacyMultiCodeIdentity> = {
  'content/extras/01/vitepress.md:10': {
    legacyId: 'kpo-ai-10-multi-code-fkj4cl',
    canonicalHash: '1qmfnri'
  },
  'content/extras/_template/vitepress.md:10': {
    legacyId: 'kpo-ai-10-multi-code-bzi8f3',
    canonicalHash: 'd8j6t0'
  },
  'content/lectures/Lec1/vitepress.md:198': {
    legacyId: 'kpo-ai-198-multi-code-fiihdp',
    canonicalHash: 'ju5qt2'
  },
  'content/lectures/Lec1/vitepress.md:349': {
    legacyId: 'kpo-ai-349-multi-code-1jgpzbc',
    canonicalHash: 'zxq68z'
  },
  'content/lectures/Lec1/vitepress.md:451': {
    legacyId: 'kpo-ai-451-multi-code-chlo9m',
    canonicalHash: '19q62wh'
  },
  'content/lectures/Lec1/vitepress.md:524': {
    legacyId: 'kpo-ai-524-multi-code-1ml8ccq',
    canonicalHash: '1gadbwh'
  },
  'content/lectures/Lec1/vitepress.md:624': {
    legacyId: 'kpo-ai-624-multi-code-n58ma2',
    canonicalHash: '1wzqn6p'
  },
  'content/lectures/Lec1/vitepress.md:780': {
    legacyId: 'kpo-ai-780-multi-code-z0we4u',
    canonicalHash: '1cw9oit'
  },
  'content/lectures/Lec1/vitepress.md:968': {
    legacyId: 'kpo-ai-968-multi-code-iksbo3',
    canonicalHash: '14er8ns'
  },
  'content/lectures/Lec1/vitepress.md:1222': {
    legacyId: 'kpo-ai-1222-multi-code-13edg8d',
    canonicalHash: '1k09xvq'
  },
  'content/lectures/Lec1/vitepress.md:1390': {
    legacyId: 'kpo-ai-1390-multi-code-7fnhn1',
    canonicalHash: '13xklhi'
  },
  'content/lectures/Lec1/vitepress.md:1531': {
    legacyId: 'kpo-ai-1531-multi-code-1ivkrdc',
    canonicalHash: '1orgdi3'
  },
  'content/lectures/Lec1/vitepress.md:1753': {
    legacyId: 'kpo-ai-1753-multi-code-1n4l2y8',
    canonicalHash: '187oc4b'
  },
  'content/lectures/Lec10/vitepress.md:486': {
    legacyId: 'kpo-ai-486-multi-code-10bb9h3',
    canonicalHash: '1q6phng'
  },
  'content/lectures/Lec10/vitepress.md:619': {
    legacyId: 'kpo-ai-619-multi-code-xqy4wu',
    canonicalHash: '18d0vxx'
  },
  'content/lectures/Lec10/vitepress.md:714': {
    legacyId: 'kpo-ai-714-multi-code-1rza738',
    canonicalHash: '17b5nlb'
  },
  'content/lectures/Lec10/vitepress.md:880': {
    legacyId: 'kpo-ai-880-multi-code-10nmagr',
    canonicalHash: '12qt6ty'
  },
  'content/lectures/Lec11/vitepress.md:344': {
    legacyId: 'kpo-ai-344-multi-code-1qla3at',
    canonicalHash: 'pp2nlq'
  },
  'content/lectures/Lec11/vitepress.md:489': {
    legacyId: 'kpo-ai-489-multi-code-7y2czv',
    canonicalHash: '13g15ra'
  },
  'content/lectures/Lec11/vitepress.md:543': {
    legacyId: 'kpo-ai-543-multi-code-13oifsc',
    canonicalHash: 'nmgt47'
  },
  'content/lectures/Lec11/vitepress.md:679': {
    legacyId: 'kpo-ai-679-multi-code-vwns0h',
    canonicalHash: 'lqp49m'
  },
  'content/lectures/Lec11/vitepress.md:875': {
    legacyId: 'kpo-ai-875-multi-code-1q8mtp9',
    canonicalHash: 'hsmt2'
  },
  'content/lectures/Lec11/vitepress.md:992': {
    legacyId: 'kpo-ai-992-multi-code-fddzf8',
    canonicalHash: '11b2a4f'
  },
  'content/lectures/Lec11/vitepress.md:1370': {
    legacyId: 'kpo-ai-1370-multi-code-1q4jtze',
    canonicalHash: 'irvy69'
  },
  'content/lectures/Lec12/vitepress.md:216': {
    legacyId: 'kpo-ai-216-multi-code-1urdia7',
    canonicalHash: 'wg3rgk'
  },
  'content/lectures/Lec12/vitepress.md:380': {
    legacyId: 'kpo-ai-380-multi-code-mg10bt',
    canonicalHash: '1sfep6q'
  },
  'content/lectures/Lec12/vitepress.md:556': {
    legacyId: 'kpo-ai-556-multi-code-17donmn',
    canonicalHash: '1obg104'
  },
  'content/lectures/Lec12/vitepress.md:900': {
    legacyId: 'kpo-ai-900-multi-code-352jo3',
    canonicalHash: '2dfj14'
  },
  'content/lectures/Lec12/vitepress.md:1107': {
    legacyId: 'kpo-ai-1107-multi-code-1lk3t1z',
    canonicalHash: 'cea2v0'
  },
  'content/lectures/Lec13/vitepress.md:269': {
    legacyId: 'kpo-ai-269-multi-code-y0unip',
    canonicalHash: '3x02re'
  },
  'content/lectures/Lec13/vitepress.md:453': {
    legacyId: 'kpo-ai-453-multi-code-nnacxt',
    canonicalHash: '1aghzhm'
  },
  'content/lectures/Lec13/vitepress.md:596': {
    legacyId: 'kpo-ai-596-multi-code-8v2zm7',
    canonicalHash: 'hpksf8'
  },
  'content/lectures/Lec14/vitepress.md:320': {
    legacyId: 'kpo-ai-320-multi-code-zywnbi',
    canonicalHash: '1bro9np'
  },
  'content/lectures/Lec14/vitepress.md:422': {
    legacyId: 'kpo-ai-422-multi-code-1a9zwg',
    canonicalHash: 'r4b1yj'
  },
  'content/lectures/Lec14/vitepress.md:617': {
    legacyId: 'kpo-ai-617-multi-code-qitypl',
    canonicalHash: '1ecdguq'
  },
  'content/lectures/Lec14/vitepress.md:750': {
    legacyId: 'kpo-ai-750-multi-code-khzj6f',
    canonicalHash: '1yuf5cs'
  },
  'content/lectures/Lec14/vitepress.md:878': {
    legacyId: 'kpo-ai-878-multi-code-1blsu1l',
    canonicalHash: 'kf22vm'
  },
  'content/lectures/Lec14/vitepress.md:999': {
    legacyId: 'kpo-ai-999-multi-code-10b5pet',
    canonicalHash: '35ijgu'
  },
  'content/lectures/Lec2/vitepress.md:144': {
    legacyId: 'kpo-ai-144-multi-code-1rk7s25',
    canonicalHash: 'imsspy'
  },
  'content/lectures/Lec2/vitepress.md:247': {
    legacyId: 'kpo-ai-247-multi-code-tue9p7',
    canonicalHash: 'ya7ze8'
  },
  'content/lectures/Lec2/vitepress.md:351': {
    legacyId: 'kpo-ai-351-multi-code-bd99gk',
    canonicalHash: 'nupv67'
  },
  'content/lectures/Lec2/vitepress.md:441': {
    legacyId: 'kpo-ai-441-multi-code-fg85ae',
    canonicalHash: 'peh71p'
  },
  'content/lectures/Lec2/vitepress.md:526': {
    legacyId: 'kpo-ai-526-multi-code-7el1vv',
    canonicalHash: '1o93jnk'
  },
  'content/lectures/Lec2/vitepress.md:800': {
    legacyId: 'kpo-ai-800-multi-code-1o53mgl',
    canonicalHash: 'z5482m'
  },
  'content/lectures/Lec2/vitepress.md:928': {
    legacyId: 'kpo-ai-928-multi-code-6nufkp',
    canonicalHash: 'wwi0aa'
  },
  'content/lectures/Lec2/vitepress.md:1019': {
    legacyId: 'kpo-ai-1019-multi-code-1y5slit',
    canonicalHash: '1zv7i6'
  },
  'content/lectures/Lec2/vitepress.md:1118': {
    legacyId: 'kpo-ai-1118-multi-code-x19rv6',
    canonicalHash: '4ib6d5'
  },
  'content/lectures/Lec2/vitepress.md:1336': {
    legacyId: 'kpo-ai-1336-multi-code-1gwaq7w',
    canonicalHash: '1wu0sev'
  },
  'content/lectures/Lec3/vitepress.md:419': {
    legacyId: 'kpo-ai-419-multi-code-4qg9xa',
    canonicalHash: '1bq5cl'
  },
  'content/lectures/Lec3/vitepress.md:834': {
    legacyId: 'kpo-ai-834-multi-code-5olp1b',
    canonicalHash: '925j84'
  },
  'content/lectures/Lec3/vitepress.md:983': {
    legacyId: 'kpo-ai-983-multi-code-1t5o0ff',
    canonicalHash: 'q5en0g'
  },
  'content/lectures/Lec4/vitepress.md:274': {
    legacyId: 'kpo-ai-274-multi-code-1m6x1ha',
    canonicalHash: '1cl6wr7'
  },
  'content/lectures/Lec4/vitepress.md:430': {
    legacyId: 'kpo-ai-430-multi-code-p7tqow',
    canonicalHash: 'sbaerx'
  },
  'content/lectures/Lec4/vitepress.md:586': {
    legacyId: 'kpo-ai-586-multi-code-s5q2go',
    canonicalHash: '1cave51'
  },
  'content/lectures/Lec4/vitepress.md:820': {
    legacyId: 'kpo-ai-820-multi-code-1czfhoq',
    canonicalHash: '1mup11j'
  },
  'content/lectures/Lec4/vitepress.md:984': {
    legacyId: 'kpo-ai-984-multi-code-sb334r',
    canonicalHash: '1bzj6gm'
  },
  'content/lectures/Lec4/vitepress.md:1312': {
    legacyId: 'kpo-ai-1312-multi-code-5knqh',
    canonicalHash: '1lgdijo'
  },
  'content/lectures/Lec6/vitepress.md:182': {
    legacyId: 'kpo-ai-182-multi-code-1kb87vm',
    canonicalHash: '1ub34hb'
  },
  'content/lectures/Lec6/vitepress.md:449': {
    legacyId: 'kpo-ai-449-multi-code-pgsspz',
    canonicalHash: '57o4dm'
  },
  'content/lectures/Lec6/vitepress.md:670': {
    legacyId: 'kpo-ai-670-multi-code-1k8h8q8',
    canonicalHash: 'rntwe5'
  },
  'content/lectures/Lec6/vitepress.md:878': {
    legacyId: 'kpo-ai-878-multi-code-1ebl4iv',
    canonicalHash: '1uec70q'
  },
  'content/lectures/Lec6/vitepress.md:1211': {
    legacyId: 'kpo-ai-1211-multi-code-xbaj25',
    canonicalHash: '1j4eaa8'
  },
  'content/lectures/Lec7/vitepress.md:208': {
    legacyId: 'kpo-ai-208-multi-code-1i1qjds',
    canonicalHash: 'qq8z1'
  },
  'content/lectures/Lec7/vitepress.md:259': {
    legacyId: 'kpo-ai-259-multi-code-1yyaqek',
    canonicalHash: '1fb7329'
  },
  'content/lectures/Lec7/vitepress.md:396': {
    legacyId: 'kpo-ai-396-multi-code-l91u2q',
    canonicalHash: '60b2mh'
  },
  'content/lectures/Lec7/vitepress.md:564': {
    legacyId: 'kpo-ai-564-multi-code-pajzrg',
    canonicalHash: 'f4ufk7'
  },
  'content/lectures/Lec7/vitepress.md:814': {
    legacyId: 'kpo-ai-814-multi-code-1hr23fl',
    canonicalHash: '4lp0bu'
  },
  'content/lectures/Lec7/vitepress.md:1100': {
    legacyId: 'kpo-ai-1100-multi-code-1ed72gu',
    canonicalHash: '19yr1kl'
  },
  'content/lectures/Lec7/vitepress.md:1424': {
    legacyId: 'kpo-ai-1424-multi-code-149t4ms',
    canonicalHash: '1e7pnsv'
  },
  'content/lectures/Lec7/vitepress.md:1558': {
    legacyId: 'kpo-ai-1558-multi-code-14u6c6v',
    canonicalHash: 'v9smhm'
  },
  'content/lectures/Lec8/vitepress.md:247': {
    legacyId: 'kpo-ai-247-multi-code-2x2cwf',
    canonicalHash: '1xi839e'
  },
  'content/lectures/Lec8/vitepress.md:486': {
    legacyId: 'kpo-ai-486-multi-code-t5val0',
    canonicalHash: 'p2gd33'
  },
  'content/lectures/Lec8/vitepress.md:717': {
    legacyId: 'kpo-ai-717-multi-code-19k8o12',
    canonicalHash: '42unm3'
  },
  'content/lectures/Lec8/vitepress.md:1025': {
    legacyId: 'kpo-ai-1025-multi-code-a1yfjx',
    canonicalHash: 'rnk7m8'
  },
  'content/lectures/Lec8/vitepress.md:1153': {
    legacyId: 'kpo-ai-1153-multi-code-17fbio3',
    canonicalHash: 'kzepgo'
  },
  'content/lectures/Lec9/vitepress.md:349': {
    legacyId: 'kpo-ai-349-multi-code-197ko1i',
    canonicalHash: '1sy7l7h'
  },
  'content/lectures/Lec9/vitepress.md:668': {
    legacyId: 'kpo-ai-668-multi-code-17l5nsm',
    canonicalHash: '13f7d5p'
  },
  'content/lectures/Lec9/vitepress.md:792': {
    legacyId: 'kpo-ai-792-multi-code-htox3e',
    canonicalHash: 'czysn5'
  },
  'content/lectures/Lec9/vitepress.md:1003': {
    legacyId: 'kpo-ai-1003-multi-code-y1ckjz',
    canonicalHash: '1quyj38'
  },
  'content/lectures/_template/vitepress.md:20': {
    legacyId: 'kpo-ai-20-multi-code-cqqtuq',
    canonicalHash: '2ug7gp'
  }
}

export function migratedDefaultKotlinCompatibilityEntries(): ReadonlyArray<
  LegacyMultiCodeIdentity & { key: string }
> {
  return Object.entries(migratedDefaultKotlinIds).map(([key, identity]) => ({ key, ...identity }))
}

export function legacyMultiCodeBlockId(
  sourcePath: string | undefined,
  lineStart: number,
  markdown: string
): string | null {
  const normalizedPath = normalizeContentPath(sourcePath)
  if (!normalizedPath) return null
  const identity = migratedDefaultKotlinIds[`${normalizedPath}:${lineStart}`]
  if (!identity) return null

  const canonical = canonicalizeDefaultKotlinMigration(markdown)
  return stableHash(canonical) === identity.canonicalHash ? identity.legacyId : null
}

export function canonicalizeDefaultKotlinMigration(markdown: string): string {
  return markdown
    .replace(/\{([^}]*?)\bdefault=kotlin\b([^}]*)\}/, (_match, before, after) => {
      const options = `${before} ${after}`.trim().replace(/\s+/g, ' ')
      return options ? `{${options}}` : ''
    })
    .replace(/[ \t]+$/gm, '')
    .replace(/^(\s*:{3,}\s+multi-code[^\n]*?)[ \t]+$/m, '$1')
    .trim()
}

function normalizeContentPath(sourcePath: string | undefined): string {
  if (!sourcePath) return ''
  const normalized = sourcePath.replace(/\\/g, '/')
  const contentIndex = normalized.lastIndexOf('/content/')
  if (contentIndex >= 0) return normalized.slice(contentIndex + 1)
  if (normalized.startsWith('content/')) return normalized
  return `content/${normalized.replace(/^\//, '')}`
}
