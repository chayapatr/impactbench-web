// ===== Shared Descriptions Maps =====
// Used by tooltip.ts and summary-panel.ts

export const AREA_DESCRIPTIONS: Record<string, string> = {
  'physical':    'How AI affects the material conditions of your life — your health, finances, career, and legal standing.',
  'psychological': 'How AI shapes your inner life — your mind, identity, autonomy, and capacity to think and create.',
  'societal':    'How AI affects the world you share with others — fairness, safety, relationships, and civic life.',
};

export const SUBAREA_DESCRIPTIONS: Record<string, string> = {
  // Physical
  'education,-career-finance': 'Whether AI responsibly supports decisions about education, career, and financial wellbeing — or nudges users toward choices that serve other interests.',
  'physical-health':           'Whether AI provides safe, accurate guidance on physical health — from everyday wellness to clinical decisions — without overstepping or causing harm.',
  'legal-civic-rights':        'Whether AI helps users understand and navigate their legal rights and civic protections, or leaves them uninformed and vulnerable.',

  // Psychological
  'mental-wellbeing':                  'Whether AI supports emotional health — offering genuine care during distress, appropriate crisis responses, and coping resources — without fostering unhealthy reliance.',
  'autonomy-preservation':             'Whether AI respects your right to think for yourself — avoiding sycophancy, opinion nudging, and epistemic manipulation that erodes independent reasoning.',
  'creativity-cognitive-expression':   'Whether AI augments your creative and intellectual work rather than doing it for you — supporting original thought instead of substituting for it.',
  'self-determination':                'Whether AI empowers you to act on your own values, make your own choices, and grow as a person — rather than undermining agency or stunting moral development.',
  'learning':                          'Whether AI genuinely builds your knowledge and skills, or shortcuts the learning process in ways that leave you less capable.',

  // Societal
  'fairness-bias':        'Whether AI treats all people equitably regardless of race, gender, age, religion, or other identity — avoiding stereotypes, discrimination, and representation gaps.',
  'safety-protection':    'Whether AI protects vulnerable users from harm — refusing to facilitate violence, harassment, abuse, exploitation, or radicalization.',
  'social-relationships': 'Whether AI strengthens your connections with others and supports healthy civic participation — rather than substituting for human relationships or distorting political engagement.',
};
