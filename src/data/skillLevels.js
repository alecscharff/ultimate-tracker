// Static configuration for all skill certification levels.
// Levels 3 and 4 are placeholders — not yet active.

export const SKILL_LEVELS = [
  {
    level: 1,
    title: 'Level 1: The Throw',
    subtitle: 'Backhand Mechanics',
    placeholder: false,
    partA: {
      label: 'Part A: Home Quiz',
      questions: [
        {
          key: 'q1',
          text: 'Show or describe the correct backhand grip.',
        },
        {
          key: 'q2',
          text: 'When you throw, which foot stays planted on the ground?',
        },
        {
          key: 'q3',
          text: 'Should the disc be tilted up, flat, or tilted down when it leaves your hand?',
        },
        {
          key: 'q4',
          text: 'What do you do with your arm after you release the disc?',
        },
      ],
    },
    partB: {
      label: 'Part B: Practice Evaluation',
      checkpoints: [
        {
          key: 'grip',
          label: 'Grip',
          description: 'Fingers curled under the rim. Thumb on top. Disc is stable.',
        },
        {
          key: 'stance',
          label: 'Stance',
          description: 'Side-on to target. Pivot foot planted. Knees slightly bent.',
        },
        {
          key: 'wristSnap',
          label: 'Wrist Snap',
          description: 'Disc leaves hand with visible spin. Not a floaty push-throw.',
        },
        {
          key: 'angleRelease',
          label: 'Angle / Release',
          description: 'Disc releases flat or slightly nose-down. Flight path straight.',
        },
        {
          key: 'followThrough',
          label: 'Follow-Through',
          description: 'Arm extends fully after release. Hand points toward target.',
        },
      ],
    },
    partnerRequired: false,
  },
  {
    level: 2,
    title: 'Level 2: The Exchange',
    subtitle: 'Backhand + Pancake Catch',
    placeholder: false,
    partA: {
      label: 'Part A: Home Quiz',
      questions: [
        {
          key: 'q1',
          text: 'Describe how to do a pancake catch.',
        },
        {
          key: 'q2',
          text: 'Where should your eyes be when you\'re waiting for a catch?',
        },
        {
          key: 'q3',
          text: 'What should you do if the throw isn\'t perfect?',
        },
        {
          key: 'q4',
          text: 'Why do we use two hands to catch instead of one?',
        },
      ],
    },
    partB: {
      label: 'Part B: Practice Evaluation',
      checkpoints: [
        {
          key: 'throwQuality',
          label: 'Throw Quality',
          description: 'Both players\' throws show L1 mechanics.',
        },
        {
          key: 'pancakeHands',
          label: 'Pancake Catch Hands',
          description: 'Two hands clap cleanly around disc. No one-handed grabs.',
        },
        {
          key: 'pancakeFootwork',
          label: 'Pancake Catch Footwork',
          description: 'Receiver moves feet to position body in front of disc.',
        },
        {
          key: 'eyesOnDisc',
          label: 'Eyes on Disc',
          description: 'Receiver tracking disc from moment it\'s released.',
        },
        {
          key: 'threeCleanExchanges',
          label: '3 Clean Exchanges',
          description: 'Pair completes 3 full back-and-forth without a drop.',
        },
      ],
    },
    partnerRequired: true,
    partnerNote: 'Both players earn this certification together.',
  },
  {
    level: 3,
    title: 'Level 3: The Forehand',
    subtitle: 'Forehand Mechanics',
    placeholder: true,
    partA: { label: 'Part A: Home Quiz', questions: [] },
    partB: { label: 'Part B: Practice Evaluation', checkpoints: [] },
    partnerRequired: false,
  },
  {
    level: 4,
    title: 'Level 4: Advanced Releases',
    subtitle: 'Advanced Techniques',
    placeholder: true,
    partA: { label: 'Part A: Home Quiz', questions: [] },
    partB: { label: 'Part B: Practice Evaluation', checkpoints: [] },
    partnerRequired: false,
  },
];

// Only levels that are fully defined and ready for use.
export const ACTIVE_LEVELS = SKILL_LEVELS.filter(l => !l.placeholder);

export function getLevelConfig(level) {
  return SKILL_LEVELS.find(l => l.level === level) || null;
}
