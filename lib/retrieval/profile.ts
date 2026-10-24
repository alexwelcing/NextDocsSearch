// Profile intent ("who is Alex?"), moved out of lib/chat/archiveQuery.ts so retrieval has no
// filesystem dependency. archiveQuery keeps its copy until the Ship handler switches over, and
// profile.test.ts pins the two to the same answers.

const profileIntentPattern =
  /(who (are|is) (you|alex)|what do (you|alex) do|where do (you|alex) (live|work)|where (are|is) (you|alex) based|what('?s| is) (your|alex'?s) purpose|what('?s| is) this site for|what is alex welcing|tell me about alex|tell me about yourself)/i

export function detectProfileIntent(query: string): boolean {
  return profileIntentPattern.test(query)
}

/** The operator doc whose chunks become profileFacts when profile intent fires. */
export const PROFILE_SLUG = 'about'
