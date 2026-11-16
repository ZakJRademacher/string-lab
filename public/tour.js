// tour.js: the guided tour. Pure data plus a few helpers, so it can be tested.
//
// The story follows the four ideas in README.md, "the problem, the idea, the cost and
// the catch". Each one answers the question the one before it raises.
//
// Written for ANYONE: short sentences, everyday words, no symbols.
//   body  = what everyone reads (a test keeps it under 60 words per step)
//   try   = one small thing to do with the picture (drag, zoom)
//   state = the settings that make the picture match the words (any module)
//   cycle = optional list of variations the picture steps through by itself
//           (every cycleMs milliseconds), so the picture does the demonstrating
// The last step of each chapter is the takeaway: the one idea worth remembering.

const DANCING_LOOP = { kind: 'relativistic', family: 'burden', m: 1, n: 2, psi: 1.2, speed: 0.6, sheet: 'off' };
// A guitar-like string, played fast enough to see it vibrate: at speed 2 the lowest
// note takes about 3 seconds per swing (at the default 0.6 it took over 10, so it looked frozen).
const GUITAR = { kind: 'open', harmonics: '1,0,0,0,0,0,0,0', speed: 2 };
const CUBE = (dim) => ({ dim, shape: 'cube', projection: 'perspective', speed: 0.4, spin: 'auto' });

// The picture behind the welcome screen (app.js shows it before the tour starts).
export const WELCOME_PICTURE = { tab: 'string', string: DANCING_LOOP };

// The four stops. The welcome screen (in index.html) comes before them.
export const TOUR = [
  {
    id: 'problem',
    title: 'The problem',
    steps: [
      {
        title: 'The very small',
        body: [
          'Physics has two great theories. The first, quantum mechanics, explains the very small: atoms, light and particles.',
          'It says a particle is not a neat dot but a shimmering cloud. That comes from the uncertainty principle: nobody can know exactly where something is and how it moves at once, so it is always a bit spread out and never still.',
        ],
        state: { tab: 'problem', problem: { focus: 'small', mass: 1, speed: 0.6 } },
      },
      {
        title: 'The very large',
        body: [
          'The second is Einstein\'s theory of gravity. It explains the very large: planets, stars and galaxies.',
          'It says heavy things bend space, like a ball on a trampoline, and that bend is gravity. Watch the star get heavier and the dip get deeper. The moon just follows the curve.',
        ],
        state: { tab: 'problem', problem: { focus: 'large', mass: 1, speed: 0.6 } },
        cycle: [{ problem: { mass: 1 } }, { problem: { mass: 6 } }, { problem: { mass: 20 } }],
      },
      {
        title: 'Where they clash',
        body: [
          'Most of the time, the two theories never meet. But squeeze a star as heavy as the Sun into a ball about 6 km wide and it becomes a black hole: incredibly heavy and incredibly small at once.',
          'Near its centre you need both theories together, and together they give nonsense. The flickering shows the maths breaking down.',
        ],
        state: { tab: 'problem', problem: { focus: 'clash', mass: 1, speed: 0.6 } },
      },
      {
        title: 'Why the maths breaks',
        body: [
          'The more you squeeze a particle, the more energy it gets: that\'s the uncertainty principle.',
          'Other forces barely change strength with energy. Gravity grows with it. So the smaller you look, the stronger gravity gets, without limit. Add up every size and the maths answers "infinity": its way of saying "no idea".',
        ],
      },
      {
        takeaway: true,
        title: 'The big idea',
        body: [
          'Our two best theories of nature don\'t fit together. Physicists have searched for one theory that covers both for nearly a hundred years.',
          'String theory is the best-known attempt. So what does it say?',
        ],
      },
    ],
  },
  {
    id: 'idea',
    title: 'The idea',
    steps: [
      {
        title: 'Strings, not dots',
        body: [
          'We usually picture the smallest particles as dots. String theory says each one is really a tiny string, far too small to ever see.',
          'And like a guitar string, it can vibrate.',
        ],
        state: { tab: 'string', string: GUITAR },
      },
      {
        title: 'One string, many notes',
        body: [
          'A guitar string can play many different notes. Watch this one switch between its first three notes, then a mix of them.',
          'In string theory, each way of vibrating would be a different particle: one note an electron, another a particle of light. One kind of string could make everything.',
        ],
        state: { tab: 'string', string: GUITAR },
        cycle: [
          { string: { harmonics: '1,0,0,0,0,0,0,0' } },
          { string: { harmonics: '0,1,0,0,0,0,0,0' } },
          { string: { harmonics: '0,0,1,0,0,0,0,0' } },
          { string: { harmonics: '1,0.45,0.25,0.12,0,0,0,0' } },
        ],
        cycleMs: 4500, // long enough to watch the lowest note swing more than once
      },
      {
        takeaway: true,
        title: 'The big idea',
        body: [
          'Strings can also be closed loops, like this one. One of a loop\'s vibrations behaves exactly like gravity. Nobody put gravity in: it comes along by itself.',
          'So strings could bring the very small and gravity together in one theory. Sounds great. So what\'s the catch?',
        ],
        state: { tab: 'string', string: DANCING_LOOP },
      },
    ],
  },
  {
    id: 'cost',
    title: 'The cost',
    steps: [
      {
        title: 'Ten dimensions',
        body: [
          'There is a price. The idea only works if the universe has ten dimensions: nine directions of space, plus time. We only notice three.',
          'Here is the shadow of a cube with extra directions we can\'t point to. Watch it gain a fourth, a fifth and a sixth. The coloured edges point into the hidden directions.',
        ],
        state: { tab: 'dimensions', dimensions: CUBE(4) },
        cycle: [{ dimensions: { dim: 4 } }, { dimensions: { dim: 5 } }, { dimensions: { dim: 6 } }],
        cycleMs: 3600,
      },
      {
        title: 'So where are they?',
        body: [
          'From far away, a garden hose looks like a thin line. Up close, it has a circle going around it.',
          'The extra dimensions could be like that circle: curled up so small that nothing we build could ever notice them.',
        ],
        state: { tab: 'compactification', compactification: { R: 3, n: 1, w: 0, N: 1, speed: 0.6 } },
      },
      {
        title: 'The shape matters',
        body: [
          'Six extra dimensions can curl up in many ways. String theory needs special shapes, called Calabi–Yau shapes. This is a slice of one.',
          'The shape decides how a string can vibrate, so it would decide which particles exist in our world.',
        ],
        state: { tab: 'calabiYau', calabiYau: { n: 5, alpha: 0.785, speed: 0.3 } },
      },
      {
        title: 'Or we live on a sheet',
        body: [
          'There is another answer. Picture drops of ink on a sheet of paper: they can spread across it, but never lift off.',
          'Our whole universe might be like that ink, stuck to a three-dimensional sheet inside a bigger space.',
        ],
        state: { tab: 'dimensions', dimensions: CUBE(2) },
      },
      {
        takeaway: true,
        title: 'The big idea',
        body: [
          'The idea works, but only if there are ten dimensions. So where are they?',
          'Either curled up too small to see, or we are stuck on a sheet and can\'t reach them. If they are curled up, their shape decides what our world is made of.',
        ],
        state: { tab: 'calabiYau', calabiYau: { n: 3, alpha: 0.785, speed: 0.3 } },
      },
    ],
  },
  {
    id: 'catch',
    title: 'The catch',
    steps: [
      {
        title: 'Too small to test',
        body: [
          'Strings would be far smaller than anything we can see, even with our biggest machines.',
          'Seeing them directly would take a particle collider a million billion times more powerful than the largest one ever built.',
        ],
        state: { tab: 'string', string: { kind: 'relativistic', family: 'kibble-turok', alpha: 0.5, psi: 1.0, speed: 0.4, sheet: 'off' } },
      },
      {
        title: 'Too many shapes',
        body: [
          'There are hundreds of millions of ways to curl up the extra dimensions, and each would give a different universe. Here are just a few.',
          'Nobody knows how to find the one that matches ours, so string theory can\'t yet predict what we see.',
        ],
        state: { tab: 'calabiYau', calabiYau: { n: 3, alpha: 0.785, speed: 0.3 } },
        cycle: [{ calabiYau: { n: 3 } }, { calabiYau: { n: 4 } }, { calabiYau: { n: 5 } }, { calabiYau: { n: 6 } }],
      },
      {
        title: 'Still debated',
        body: [
          'Some physicists think string theory is the right path to a final theory. Others think it has been oversold.',
          'It is a bold candidate, not a proven fact. Even so, it has already given physicists new mathematics and new ways to think about space.',
        ],
      },
      {
        takeaway: true,
        title: 'The whole story',
        body: [
          'The problem: our two best theories clash. The idea: everything might be vibrating strings, which bring gravity along. The cost: ten dimensions, so where are they? The catch: nobody can test it yet.',
          'One last surprise: there are five versions of string theory, and they turned out to be one theory seen from different sides.',
        ],
        state: { tab: 'string', string: DANCING_LOOP },
      },
    ],
  },
];

/** Every step in order, with its chapter, for simple Next/Back navigation. */
export const STEPS = TOUR.flatMap((chapter, c) =>
  chapter.steps.map((step, s) => ({ ...step, chapter, chapterIndex: c, stepIndex: s })));

/** The first step of a chapter (by id), or 0 if there is no such chapter. */
export function firstStepOfChapter(id) {
  const i = STEPS.findIndex((s) => s.chapter.id === id);
  return i < 0 ? 0 : i;
}

/** Apply a step's partial state on top of a full lab state (returns a new object). */
export function applyStep(lab, step) {
  const next = structuredClone(lab);
  if (!step.state) return next;
  for (const [key, value] of Object.entries(step.state)) {
    if (key === 'tab') next.tab = value;
    else next[key] = { ...next[key], ...value };
  }
  return next;
}
