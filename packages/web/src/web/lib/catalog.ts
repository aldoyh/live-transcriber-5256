export type Episode = {
  id: number;
  show: string;
  title: string;
  host: string;
  category: string;
  duration: string;
  date: string;
  style: string;
  image?: string;
  description: string;
};
export const episodes: Episode[] = [
  {
    id: 1,
    show: "OFF THE RECORD",
    title: "The art of starting over",
    host: "Alex Morgan",
    category: "Society & Culture",
    duration: "48 min",
    date: "Today",
    style: "record",
    image: "portrait",
    description:
      "Honest conversations about the moments that change everything. Alex explores reinvention, taking the leap, and learning to trust your own voice.",
  },
  {
    id: 2,
    show: "THE CREATIVE MIND",
    title: "Make something that matters",
    host: "Studio North",
    category: "Arts & Design",
    duration: "36 min",
    date: "Today",
    style: "creative",
    image: "architecture",
    description:
      "Behind the ideas that move us. A fresh perspective on creative work, the spaces we inhabit, and finding meaning in the things we make.",
  },
  {
    id: 3,
    show: "BEYOND ORBIT",
    title: "Are we really alone?",
    host: "Dr. Maya Chen",
    category: "Science",
    duration: "52 min",
    date: "Yesterday",
    style: "orbit",
    image: "space",
    description:
      "Big questions. Infinite possibilities. Explore the frontiers of science and our place in the universe with curious minds who look beyond the everyday.",
  },
  {
    id: 4,
    show: "SMALL TALK. BIG IDEAS.",
    title: "The quiet power of doing less",
    host: "Jamie & Sam",
    category: "Personal Growth",
    duration: "42 min",
    date: "Yesterday",
    style: "small",
    description:
      "A little perspective goes a long way. Two friends unpack the everyday ideas that can change how you live, work, and connect.",
  },
  {
    id: 5,
    show: "THE DAILY PERSPECTIVE",
    title: "A different way to see the world",
    host: "The Perspective Network",
    category: "News",
    duration: "28 min",
    date: "Today",
    style: "daily",
    description:
      "Step back from the headlines and discover the stories underneath. Thoughtful context for a complicated world.",
  },
  {
    id: 6,
    show: "BUILT DIFFERENT",
    title: "What comes after the big idea?",
    host: "Marcus Reed",
    category: "Business",
    duration: "44 min",
    date: "Oct 17",
    style: "built",
    image: "architecture",
    description:
      "Real stories from people building things their own way. An unfiltered look at the unexpected turns behind meaningful businesses.",
  },
  {
    id: 7,
    show: "AFTER HOURS",
    title: "Finding your own rhythm",
    host: "Nina Ellis",
    category: "Music",
    duration: "38 min",
    date: "Oct 16",
    style: "after",
    image: "hero",
    description:
      "For the love of sound. Meet the artists, makers, and listeners shaping the music that stays with us.",
  },
  {
    id: 8,
    show: "GOOD COMPANY",
    title: "The stories we tell ourselves",
    host: "Leo & friends",
    category: "Comedy",
    duration: "55 min",
    date: "Oct 15",
    style: "company",
    image: "portrait",
    description:
      "Good people. Better stories. Get comfortable for a thoughtful, funny conversation about the beautiful mess of being human.",
  },
];
export const categories = [
  "All podcasts",
  "Society & Culture",
  "Business",
  "Arts & Design",
  "Science",
  "Personal Growth",
  "Comedy",
  "Music",
  "News",
];
