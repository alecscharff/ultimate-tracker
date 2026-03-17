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
    subtitle: 'Forehand Throw (GLADS)',
    placeholder: false,
    partA: {
      label: 'Part A: Home Quiz',
      questions: [
        { key: 'q1', text: 'What does GLADS stand for?' },
        { key: 'q2', text: 'Describe or show the standard forehand grip.' },
        { key: 'q3', text: 'How is the forehand stance different from the backhand stance?' },
        { key: 'q4', text: 'What does your wrist do when you throw a forehand?' },
      ],
    },
    partB: {
      label: 'Part B: Practice Evaluation',
      checkpoints: [
        { key: 'grip',        label: 'Grip',           description: 'Standard or peace sign grip. Two fingers inside rim, two outside (or peace sign). Thumb on top.' },
        { key: 'lockIt',      label: 'Lock It',        description: 'Coach shakes disc lightly — disc does not move.' },
        { key: 'aim',         label: 'Aim',            description: 'Chest faces target. Steps out with free foot before throwing.' },
        { key: 'discAngle',   label: 'Disc Angle',     description: 'Disc stays parallel to ground throughout throw.' },
        { key: 'snap',        label: 'Snap',           description: 'Visible wrist snap at release. Throw shows clear spin. Can demonstrate wrist-only throw.' },
        { key: 'threeThrows', label: '3 Clean Throws', description: 'Completes 3 forehand throws with all 5 checkpoints demonstrated.' },
      ],
    },
    partnerRequired: false,
  },
  {
    level: 4,
    title: 'Level 4: Pivot & Fake',
    subtitle: 'Decision-Making Under Pressure',
    placeholder: false,
    partA: {
      label: 'Part A: Home Quiz',
      questions: [
        { key: 'q1', text: 'Which foot is your pivot foot, and what happens if you lift it?' },
        { key: 'q2', text: 'Why is one good fake usually enough?' },
        { key: 'q3', text: 'When should you make eye contact with the player you actually want to throw to?' },
        { key: 'q4', text: 'Describe a backhand-forehand fake.' },
      ],
    },
    partB: {
      label: 'Part B: Practice Evaluation',
      checkpoints: [
        { key: 'pivotFoot',            label: 'Name Pivot Foot',            description: 'Player correctly identifies their pivot foot (opposite throwing hand).' },
        { key: 'pivotPastMark',        label: 'Pivot Past Mark',            description: 'Uses free foot to step past a stationary defender without lifting pivot foot.' },
        { key: 'backhForehandFake',    label: 'Backhand → Forehand Fake',   description: 'Convincing backhand fake, then pivots and delivers forehand to open lane.' },
        { key: 'forehandForehandFake', label: 'Forehand → Forehand Fake',   description: 'Fakes forehand high/outside, delivers forehand low/inside (or vice versa).' },
        { key: 'threeComboReps',       label: '3 Fake + Throw Combos',      description: 'Completes 3 successful fake+throw combos with a partner acting as defender.' },
      ],
    },
    partnerRequired: false,
  },
];

// Only levels that are fully defined and ready for use.
export const ACTIVE_LEVELS = SKILL_LEVELS.filter(l => !l.placeholder);

export function getLevelConfig(level) {
  return SKILL_LEVELS.find(l => l.level === level) || null;
}
