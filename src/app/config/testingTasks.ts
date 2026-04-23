export type StepType = 'todo' | 'question' | 'yesno' | 'rating';

export interface TaskStep {
  type: StepType;
  text: string;
  /** Rating scale end labels (1 = lowLabel, 5 = highLabel). Only used for type 'rating'. */
  lowLabel?:  string;
  highLabel?: string;
}

export interface TestingTask {
  id:            string;
  title:         string;
  timeEstimate:  string;
  description:   string;
  steps:         TaskStep[];
  feedbackGoalHint: string;
}

// Scenario shared across all tasks:
// "You own a house. You've been thinking about solar panels.
//  You know roughly how big it is, when it was built, and that one side faces south."

export const TESTING_TASKS: TestingTask[] = [
  {
    id:           'task-1',
    title:        'First impressions',
    timeEstimate: '3–5 min',
    description:  'Welcome to the testing session!. Take a minute to look around the map — don\'t click anything yet.',
    steps: [
      { type: 'rating',   text: 'How clear is it what you\'re supposed to do on this screen?', lowLabel: 'No idea', highLabel: 'Immediately clear' },
      { type: 'rating',   text: 'How easy is it to find a building to explore?', lowLabel: 'Very hard to find', highLabel: 'Obvious' },
      { type: 'todo',     text: 'Click on a building to view its details' },
      { type: 'rating',   text: 'How easy was it to view the building details?', lowLabel: 'Very difficult', highLabel: 'Very easy' },
      { type: 'rating',   text: 'How approachable does the tool feel overall so far?', lowLabel: 'Overwhelming', highLabel: 'Easy to approach' },
    ],
    feedbackGoalHint: 'I landed on the map for the first time and was trying to understand what to do and how to view a building\'s details.',
  },
  {
    id:           'task-2',
    title:        'Understand the building overview',
    timeEstimate: '5 min',
    description:  'You\'ve opened a building overview dashboard. The tool consists of two modes – a building overview and a building configurator. You can switch between them by clicking on "Open Configurator" or "Back to Overview". The tool has filled in some data automatically from public records. Take a moment to explore what\'s shown — the energy figures, the building parameters, and the envelope breakdown.',
    steps: [
      { type: 'yesno',    text: 'Is the energy usage information easy to read and understand?' },
      { type: 'yesno',    text: 'Try to change a building parameter. Was it easy to do?' },
      { type: 'rating',    text: 'Does it feel like too much information at once?', lowLabel: 'Overwhelming', highLabel: 'Not at all' },
      { type: 'rating',   text: 'How easy is it to understand what the overview is showing?', lowLabel: 'Very confusing', highLabel: 'Very clear' },
    ],
    feedbackGoalHint: 'I was looking at the building overview — energy figures, pre-filled parameters, and building envelope breakdown.',
  },
  {
    id:           'task-3',
    title:        'Open the configurator and change building information',
    timeEstimate: '5 min',
    description:  'Now open the configurator. Look for option to change the building parameters and the envelope surface properties. Try changing a few values around to see how it works.',
    steps: [
      { type: 'todo',     text: 'Open the configurator from the overview' },
      { type: 'todo',     text: 'Review the building envelope and its surfaces using the 3D model' },
      { type: 'rating',   text: 'How easy was it to understand the building envelope and its surfaces?', lowLabel: 'Very difficult', highLabel: 'Very easy' },
      { type: 'todo',     text: 'Find where to change the building parameters (e.g. construction year, total floor area) and change a few values' },
      { type: 'todo',     text: 'Find where to change the surface properties (e.g. area, tilt) and change a few values' },
      { type: 'rating',   text: 'How easy was it to find where to change the building parameters?', lowLabel: 'Very difficult', highLabel: 'Very easy' },
      { type: 'rating',   text: 'How easy was it to find where to change the surface properties?', lowLabel: 'Very difficult', highLabel: 'Very easy' },
      { type: 'todo',     text: 'Go back to the overview and see if you can spot the changes you made' },
      { type: 'rating',   text: 'How easy was it to spot the changes you made in the overview?', lowLabel: 'Very difficult', highLabel: 'Very easy' },
    ],
    feedbackGoalHint: 'I was opening the configurator and reviewing the building envelope surfaces and their properties.',
  },
  {
    id:           'task-4',
    title:        'Set up the roof and add solar panels',
    timeEstimate: '8–12 min',
    description:  'Your house has a pitched roof with a south-facing slope — ideal for solar. Open the configurator, make sure the roof shape is set correctly, then add a solar PV system to the south-facing surface.',
    steps: [
      { type: 'todo',     text: 'Open the configurator again and find the roof section and check what type of roof is currently set' },
      { type: 'todo',     text: 'Change the roof type to (e.g. Gable)' },
      { type: 'todo',     text: 'Find the south-facing roof surface and add a solar PV system to it' },
      { type: 'rating',   text: 'How confident are you that the solar panels are now installed?', lowLabel: 'Not at all', highLabel: 'Very confident' },
      { type: 'rating',   text: 'How easy was this task overall?', lowLabel: 'Very difficult', highLabel: 'Very easy' },
    ],
    feedbackGoalHint: 'I was opening the configurator, setting the roof type, and adding solar panels to the south-facing surface.',
  },
  {
    id:           'task-5',
    title:        'Review the results',
    timeEstimate: '3–5 min',
    description:  'You\'ve configured the building and added solar panels. Go back to the overview to see how the energy figures have changed.',
    steps: [
      { type: 'todo',     text: 'Go back to the overview and notice the changes' },
      { type: 'yesno',    text: 'Is it clear what changed after adding solar panels?' },
      { type: 'rating',   text: 'How easy was it to review the impact of your changes?', lowLabel: 'Very difficult', highLabel: 'Very easy' },
    ],
    feedbackGoalHint: 'I was going back to the overview to review the updated results.',
  },
];
