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
    description:  'Open the tool and take a few minutes to explore freely - don\'t try to do anything specific yet. There are two main views: Overview and Configure. You can switch between them using the button in the top right.',
    steps: [
      { type: 'rating', text: 'How easy is it to understand what this tool does at first glance?', lowLabel: 'Not clear at all', highLabel: 'Immediately clear' },
      { type: 'rating', text: 'How obvious is the difference between the Overview and Configure views?', lowLabel: 'Not obvious', highLabel: 'Very obvious' },
      { type: 'rating', text: 'How approachable does the tool feel overall?', lowLabel: 'Overwhelming', highLabel: 'Easy to approach' },
    ],
    feedbackGoalHint: 'I was exploring the tool for the first time and forming an initial impression of the layout and two main views.',
  },
  {
    id:           'task-2',
    title:        'Tell the tool about your building',
    timeEstimate: '5–10 min',
    description:  'Set up your building using what you know: rough size, number of floors, and the year it was built.',
    steps: [
      { type: 'todo',   text: 'Enter roughly how big your house is and how many floors it has' },
      { type: 'todo',   text: 'Enter the year it was built (or your best guess)' },
      { type: 'todo',   text: 'See what the tool shows you after entering those details' },
      { type: 'yesno',  text: 'Does what the tool shows make sense to you?' },
      { type: 'rating', text: 'How easy was it to enter your building details?', lowLabel: 'Very difficult', highLabel: 'Very easy' },
    ],
    feedbackGoalHint: 'I was trying to enter my building details -- size, floors, and when it was built.',
  },
  {
    id:           'task-3',
    title:        'Set up the roof and add solar panels',
    timeEstimate: '8–12 min',
    description:  'Your house has a pitched roof with a south-facing slope — ideal for solar. First make sure the roof shape is set correctly, then add a solar PV system to the south-facing surface.',
    steps: [
      { type: 'todo',   text: 'Find the roof section and check what type of roof is currently set' },
      { type: 'todo',   text: 'Change the roof type to one that has a south-facing slope (e.g. Gable)' },
      { type: 'yesno',  text: 'Does the roof shape shown match what you would expect a south-facing pitched roof to look like?' },
      { type: 'todo',   text: 'Find the south-facing roof surface and add a solar PV system to it' },
      { type: 'rating', text: 'How confident are you that the solar panels are now installed?', lowLabel: 'Not at all', highLabel: 'Very confident' },
      { type: 'rating', text: 'How easy was this task overall?', lowLabel: 'Very difficult', highLabel: 'Very easy' },
    ],
    feedbackGoalHint: 'I was trying to set the roof type and add solar panels to the south-facing slope.',
  }
];
