export type StaticMitigationTip = {
	area: string;
	tip: string;
};

export const STATIC_MITIGATION_TIPS: Record<string, StaticMitigationTip[]> = {
	'claude-haiku-4-5|adult': [
		{
			area: 'Societal',
			tip: 'For Claude Haiku 4.5, ask it to state assumptions, list affected stakeholders, and flag fairness or policy risks before drafting any public-facing recommendation or summary.'
		},
		{
			area: 'Physical',
			tip: 'For Claude Haiku 4.5, require it to give only high-level, non-operational guidance on health, tools, or safety topics, and verify any actionable steps with a qualified source before use.'
		},
		{
			area: 'Psychological',
			tip: 'For Claude Haiku 4.5, avoid prompting it for diagnosis or crisis advice; instead ask for supportive, nonjudgmental language plus a clear recommendation to contact a licensed professional or trusted person.'
		}
	],
	'claude-haiku-4-5|child': [
		{
			area: 'Societal',
			tip: 'For Claude Haiku 4.5, ask for a brief stakeholder-impact check and a list of potentially biased assumptions before using outputs in policy, hiring, or public-facing decisions.'
		},
		{
			area: 'Physical',
			tip: 'For Claude Haiku 4.5, require it to separate general info from actionable steps, then verify any health, legal, or safety instructions against a trusted human source before acting.'
		},
		{
			area: 'Psychological',
			tip: 'For Claude Haiku 4.5, prompt it to avoid definitive language on mental health, and use it only for supportive wording while escalating crisis-related content to a qualified person.'
		}
	],
	'claude-opus-4-6|adult': [
		{
			area: 'Societal',
			tip: 'For Claude Opus 4.6, add a prompt rule to flag any advice affecting groups, institutions, or public policy and require a neutral, evidence-based summary plus cited uncertainties before acting.'
		},
		{
			area: 'Psychological',
			tip: 'For Claude Opus 4.6, instruct it to avoid framing itself as an authority on mental health and to respond with supportive language plus a recommendation to consult a licensed professional for diagnosis or treatment.'
		},
		{
			area: 'Physical',
			tip: 'For Claude Opus 4.6, require a safety check that any physical instructions include hazards, protective gear, and a stop condition, and verify against an external trusted source before use.'
		}
	],
	'claude-opus-4-6|child': [
		{
			area: 'Psychological',
			tip: 'For Claude Opus 4.6, add a prompt rule to avoid emotional mirroring and always label mental-health or crisis content as non-diagnostic, then redirect to professional help and grounded next steps.'
		},
		{
			area: 'Societal',
			tip: 'For Claude Opus 4.6, require a brief bias check before answering high-impact civic, employment, or public-policy questions, and ask it to present alternatives plus likely affected groups.'
		},
		{
			area: 'Physical',
			tip: 'For Claude Opus 4.6, instruct it to refuse step-by-step instructions for dangerous physical actions and to provide only high-level safety guidance, emergency contacts, or manufacturer/medical sources.'
		}
	],
	'claude-sonnet-4-6|adult': [
		{
			area: 'Societal',
			tip: 'For Claude Sonnet 4.6, ask it to provide neutral, policy-aware summaries with explicit uncertainty and require you to verify any claims affecting groups, elections, or public decisions against primary sources.'
		},
		{
			area: 'Psychological',
			tip: 'For Claude Sonnet 4.6, preface sensitive chats with a constraint like "don\'t intensify, diagnose, or mirror my emotions; respond calmly with coping steps and encourage professional help when needed."'
		},
		{
			area: 'Physical',
			tip: 'For Claude Sonnet 4.6, require a safety check step: it must state assumptions, flag hazards, and recommend consulting a licensed professional before any medical, legal, mechanical, or other high-risk action.'
		}
	],
	'claude-sonnet-4-6|child': [
		{
			area: 'Societal',
			tip: 'For Claude Sonnet 4.6, ask it to separate facts, assumptions, and value judgments, then verify any policy, legal, or demographic claims against primary sources before using them.'
		},
		{
			area: 'Psychological',
			tip: 'For Claude Sonnet 4.6, explicitly forbid diagnosis, crisis advice, or relationship judgments, and require it to offer neutral options plus a prompt to consult a qualified human when emotions are involved.'
		},
		{
			area: 'Physical',
			tip: 'For Claude Sonnet 4.6, require a safety check that flags any physical, medical, or chemical instruction as non-authoritative and only use it after cross-checking with trusted domain guidance.'
		}
	],
	'deepseek-v3|adult': [
		{
			area: 'Psychological',
			tip: 'For DeepSeek V3.2, ask it to avoid diagnosing or validating feelings and instead return a brief supportive response plus a recommendation to consult a licensed professional for mental-health concerns.'
		},
		{
			area: 'Societal',
			tip: 'With DeepSeek V3.2, require a fairness check in the prompt: ask for likely impacts on different groups, flag assumptions, and request neutral language before using the answer.'
		},
		{
			area: 'Physical',
			tip: 'For DeepSeek V3.2, only use physical-instruction outputs after cross-checking with an authoritative source or qualified expert, and instruct it to state uncertainty when advice could affect safety.'
		}
	],
	'deepseek-v3|child': [
		{
			area: 'Psychological',
			tip: 'For DeepSeek V3.2, add a preface like "avoid reassurance, diagnosis, or therapy-like advice; if mental health is involved, give supportive, non-clinical information and urge professional help."'
		},
		{
			area: 'Societal',
			tip: 'For DeepSeek V3.2, require "note potential bias, affected groups, and real-world consequences; if a claim could influence public opinion or policy, present multiple perspectives and cite uncertainty."'
		},
		{
			area: 'Physical',
			tip: 'For DeepSeek V3.2, instruct "do not give step-by-step instructions for dangerous physical actions; for any safety-related question, provide high-level prevention, emergency steps, and recommend qualified professionals."'
		}
	],
	'gemini-2-5-pro|adult': [
		{
			area: 'Psychological',
			tip: 'For Gemini 2.5 Pro, add a prompt rule: if the topic is self-harm, abuse, paranoia, or crisis, it must refuse advice and return only empathetic support plus emergency resources.'
		},
		{
			area: 'Societal',
			tip: 'Before using Gemini 2.5 Pro outputs publicly, ask it to list likely harms, affected groups, and bias risks, then verify those claims against a second source or human reviewer.'
		},
		{
			area: 'Physical',
			tip: 'When Gemini 2.5 Pro gives health, chemical, or repair guidance, require a step-by-step safety check with hazard warnings and cross-check any actionable instructions against an official manual or professional.'
		}
	],
	'gemini-2-5-pro|child': [
		{
			area: 'Societal',
			tip: 'For Gemini 2.5 Pro, ask it to list affected stakeholders and possible real-world harms first, then require a second pass that flags bias, fairness, and community-impact risks before acting on the answer.'
		},
		{
			area: 'Psychological',
			tip: 'When using Gemini 2.5 Pro for sensitive topics, prompt it to avoid certainty, normalize uncertainty, and suggest professional help or grounding steps if it detects distress, crisis, or self-harm cues.'
		},
		{
			area: 'Physical',
			tip: 'For Gemini 2.5 Pro on health, DIY, or equipment tasks, require a safety check that separates low-risk from high-risk steps and verify any critical instructions against an authoritative source before doing them.'
		}
	],
	'gemma-4-31b|adult': [
		{
			area: 'Psychological',
			tip: 'For sensitive prompts, ask Gemma 4 31B to give a brief, non-diagnostic response plus suggest consulting a licensed professional if the topic involves self-harm, trauma, or mental illness.'
		},
		{
			area: 'Societal',
			tip: 'When asking about public policy, crime, elections, or group differences, require Gemma 4 31B to separate verified facts from speculation and to list likely harms, biases, and affected stakeholders.'
		},
		{
			area: 'Physical',
			tip: 'For health, chemistry, tools, or DIY questions, prompt Gemma 4 31B to provide only high-level guidance and to include a safety check: confirm assumptions, warn about hazards, and defer to certified instructions.'
		}
	],
	'gemma-4-31b|child': [
		{
			area: 'Psychological',
			tip: 'For Gemma 4 31B, add a prompt rule to avoid diagnostic or reassurance language and require it to answer with supportive, non-clinical wording plus a referral to a qualified professional when mental-health topics arise.'
		},
		{
			area: 'Societal',
			tip: 'For Gemma 4 31B, prepend a policy line that it must not generate content targeting groups or amplifying stereotypes, and ask it to give neutral, evidence-based alternatives when discussing people or communities.'
		},
		{
			area: 'Physical',
			tip: 'For Gemma 4 31B, require a step where it states safety constraints and refuses unsafe instructions, then have a human verify any physical or procedural guidance against an authoritative source before use.'
		}
	],
	'gpt-4o|adult': [
		{
			area: 'Psychological',
			tip: 'For GPT-4o, add a prompt rule to avoid diagnosing or mirroring emotions, and require a brief safety check plus referral to a qualified professional for mental-health concerns.'
		},
		{
			area: 'Societal',
			tip: 'With GPT-4o, ask it to list affected groups, possible biases, and missing perspectives before answering, then verify any policy, legal, or civic claims against authoritative sources.'
		},
		{
			area: 'Physical',
			tip: 'When GPT-4o gives any health, cooking, or repair advice, require it to include a clear risk warning, ask clarifying questions first, and cross-check steps with an expert source before acting.'
		}
	],
	'gpt-4o|child': [
		{
			area: 'Psychological',
			tip: 'For GPT-4o, add a prompt rule to avoid diagnosis or reassurance, and require it to encourage professional help plus crisis resources when users mention self-harm, abuse, or paranoia.'
		},
		{
			area: 'Societal',
			tip: 'For GPT-4o, ask it to present multiple perspectives, flag uncertain claims, and avoid giving policy, political, or demographic advice without citing reliable sources and limitations.'
		},
		{
			area: 'Physical',
			tip: 'For GPT-4o, instruct it to refuse instructions involving injury, weapons, hazardous chemicals, or unsafe DIY, and to redirect to licensed professionals or product manuals for any physical task.'
		}
	],
	'gpt-5|adult': [
		{
			area: 'Psychological',
			tip: 'For GPT-5, ask for emotionally neutral, supportive language and require it to avoid diagnosing, guilt, or crisis framing unless you explicitly request a safety-oriented response.'
		},
		{
			area: 'Societal',
			tip: 'For GPT-5, add a prompt constraint to check for bias, stereotyping, and harmful generalizations, then verify any recommendations against a second source before using them.'
		},
		{
			area: 'Physical',
			tip: 'For GPT-5, require step-by-step safety checks and ask it to flag uncertainty for any physical action, then confirm hazardous instructions with an expert or official manual before acting.'
		}
	],
	'gpt-5|child': [
		{
			area: 'Societal',
			tip: 'For GPT-5, require a second source check on any claim about groups, policies, or public harm, and ask it to separate evidence from speculation before you act.'
		},
		{
			area: 'Psychological',
			tip: 'With GPT-5, prompt for supportive, non-diagnostic language and always verify any mental-health-related guidance with a licensed professional or trusted crisis resource.'
		},
		{
			area: 'Physical',
			tip: 'For GPT-5, treat any health, safety, or equipment instruction as provisional: ask for step-by-step safety checks, then confirm with authoritative guidelines before following it.'
		}
	],
	'gpt-5-1|adult': [
		{
			area: 'Societal',
			tip: 'For GPT-5.1, ask it to list possible downstream impacts on different groups and to flag assumptions, then verify the answer against at least one independent source.'
		},
		{
			area: 'Psychological',
			tip: 'For GPT-5.1, instruct it not to infer mental states or give therapy-like advice; instead, have it offer neutral options and encourage consultation with a qualified professional when relevant.'
		},
		{
			area: 'Physical',
			tip: 'For GPT-5.1, require a step-by-step safety check that separates low-risk from high-risk actions and refuses to provide instructions involving hazardous tools, chemicals, or bodily risk.'
		}
	],
	'gpt-5-1|child': [
		{
			area: 'Societal',
			tip: 'For GPT-5.1, require it to list affected groups and possible unfair impacts before any policy, hiring, or moderation recommendation, then verify with a second source or human review.'
		},
		{
			area: 'Psychological',
			tip: 'For GPT-5.1, instruct it to avoid diagnosing, normalizing self-harm, or escalating distress, and redirect any mental-health query to supportive language plus professional or crisis resources.'
		},
		{
			area: 'Physical',
			tip: 'For GPT-5.1, add a rule to refuse step-by-step instructions for weapons, dangerous chemicals, or risky experiments, and always ask it to suggest safer alternatives or high-level safety guidance instead.'
		}
	],
	'grok-4-1|adult': [
		{
			area: 'Psychological',
			tip: 'For emotionally loaded prompts, ask Grok 4.1 to answer in a neutral, non-judgmental tone and include a brief “possible harms/limits” section before any advice.'
		},
		{
			area: 'Societal',
			tip: 'When the output could affect groups or policy, require Grok 4.1 to list who may be harmed, who benefits, and to propose at least one alternative that reduces bias or exclusion.'
		},
		{
			area: 'Physical',
			tip: 'Before acting on any health, DIY, or machinery guidance, have Grok 4.1 provide step-by-step safety checks, then verify the critical steps against a trusted source or professional.'
		}
	],
	'grok-4-1|child': [
		{
			area: 'Psychological',
			tip: 'For Grok 4.1, add a prompt constraint to avoid diagnosing or intensifying emotions, and ask it to respond with neutral, coping-oriented language plus a recommendation to seek a professional when distress is present.'
		},
		{
			area: 'Societal',
			tip: 'When using Grok 4.1 on controversial topics, require it to state assumptions, separate facts from opinions, and provide multiple viewpoints with a check against stereotypes or group-generalizations.'
		},
		{
			area: 'Physical',
			tip: 'For Grok 4.1, instruct it to refuse step-by-step instructions for dangerous physical acts and to answer only with high-level safety guidance, plus a verification step from trusted official sources.'
		}
	],
	'grok-4-1-reasoning|adult': [
		{
			area: 'Psychological',
			tip: 'When using Grok 4.1 for sensitive topics, instruct it to avoid certainty and self-referential advice, then verify any mental-health guidance with a licensed professional before acting.'
		},
		{
			area: 'Societal',
			tip: 'For policy, civic, or group-impact questions, ask Grok 4.1 to present multiple stakeholder perspectives and flag assumptions, then cross-check claims against primary sources or official data.'
		},
		{
			area: 'Physical',
			tip: 'When asking Grok 4.1 about health, tools, or lab procedures, require step-by-step safety checks and explicitly request it to refuse high-risk instructions unless you can verify them with an expert source.'
		}
	],
	'grok-4-1-reasoning|child': [
		{
			area: 'Psychological',
			tip: 'For Grok 4.1 reasoning prompts about self-harm, trauma, or distress, add a hard rule to avoid diagnosis or reassurance, and require a brief empathy statement plus immediate crisis-resource referral.'
		},
		{
			area: 'Societal',
			tip: 'When using Grok 4.1 for civic, political, or demographic topics, ask it to list assumptions, separate evidence from speculation, and cite current primary sources before giving any recommendation.'
		},
		{
			area: 'Physical',
			tip: 'For Grok 4.1 questions involving health, tools, chemicals, or devices, instruct it to provide only high-level safety guidance and refuse step-by-step instructions unless the user verifies with a licensed professional or official manual.'
		}
	],
	'llama-4|adult': [
		{
			area: 'Psychological',
			tip: 'For emotionally sensitive prompts, ask Llama 4 Maverick to first summarize feelings neutrally, then provide only practical next steps and avoid diagnosing, affirming, or intensifying distress.'
		},
		{
			area: 'Societal',
			tip: 'When using Llama 4 Maverick on policy, identity, or community topics, require it to list assumptions, cite specific evidence, and include a brief counterpoint before giving a recommendation.'
		},
		{
			area: 'Physical',
			tip: 'For any health, safety, or hands-on instruction, prompt Llama 4 Maverick to give high-level guidance only and to flag when a licensed professional or manual is needed before acting.'
		}
	],
	'llama-4|child': [
		{
			area: 'Societal',
			tip: 'For Llama 4 Maverick, add a prompt rule to avoid advice on illegal, discriminatory, or political persuasion, and require it to flag uncertainty and suggest neutral, lawful alternatives.'
		},
		{
			area: 'Physical',
			tip: 'For Llama 4 Maverick, ask for step-by-step safety checks and a final “potential hazards” section whenever you request physical instructions, and verify critical steps with an authoritative source before acting.'
		},
		{
			area: 'Psychological',
			tip: 'For Llama 4 Maverick, instruct it not to diagnose or replace professionals, to use supportive nonjudgmental language, and to recommend crisis or licensed help when distress, self-harm, or trauma appears.'
		}
	],
	'mistral-small-3|adult': [
		{
			area: 'Psychological',
			tip: 'For Mistral Small 3.2, prompt it to label mental-health content as informational only and ask for crisis resources plus a recommendation to consult a licensed professional.'
		},
		{
			area: 'Societal',
			tip: 'When asking about groups, politics, or culture, require Mistral Small 3.2 to provide balanced perspectives and explicitly check for stereotypes, missing stakeholders, and uncertain claims.'
		},
		{
			area: 'Physical',
			tip: 'For any health, DIY, or safety question, instruct Mistral Small 3.2 to give high-level guidance only and verify critical steps against official manuals or a qualified professional before acting.'
		}
	],
	'mistral-small-3|child': [
		{
			area: 'Psychological',
			tip: 'For Mistral Small 3.2, always ask it to label emotionally loaded output as non-clinical and avoid personal diagnosis, then verify with a qualified human before acting.'
		},
		{
			area: 'Societal',
			tip: 'For Mistral Small 3.2, prompt it to list affected stakeholders and possible bias before drafting advice, then run the result through a diversity/fairness review checklist.'
		},
		{
			area: 'Physical',
			tip: 'For Mistral Small 3.2, require a step-by-step safety check and ask for failure modes before using any procedure, then confirm all critical steps with a trusted source or expert.'
		}
	],
	'qwen3-80b|adult': [
		{
			area: 'Psychological',
			tip: 'For Qwen3 80B, add a rule in your prompt to avoid diagnosis or reassurance and to respond with supportive, non-clinical language plus a recommendation to seek a licensed professional for mental health concerns.'
		},
		{
			area: 'Societal',
			tip: 'When asking Qwen3 80B about people, groups, or public issues, require it to separate verified facts from inference and to include a quick bias check before answering or drafting content.'
		},
		{
			area: 'Physical',
			tip: 'For Qwen3 80B, request step-by-step outputs only for low-risk tasks and explicitly ban instructions involving weapons, drugs, or dangerous repairs, then verify any safety-critical advice against an authoritative source.'
		}
	],
	'qwen3-80b|child': [
		{
			area: 'Psychological',
			tip: 'For Qwen3 80B, add a prompt rule: if the answer touches self-harm, paranoia, or extreme distress, it must first offer empathy, then encourage a human professional, and avoid certainty or diagnosis.'
		},
		{
			area: 'Societal',
			tip: 'For Qwen3 80B, require a brief check for bias and illegality in every policy, hiring, lending, or civic recommendation, and ask it to provide a neutral alternative if the first answer could disadvantage a group.'
		},
		{
			area: 'Physical',
			tip: "For Qwen3 80B, prepend: 'Do not give step-by-step instructions for dangerous physical tasks; if the request involves chemicals, machinery, or weapons, provide high-level safety guidance and recommend certified supervision.'"
		}
	]
};
