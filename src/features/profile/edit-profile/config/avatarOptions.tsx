// Path: src/features/profile/edit-profile/config/avatarOptions.tsx
import React from 'react';
import { 
  User, Smile, Users, Star, Heart, Sun, Moon, Cloud, Zap, Flame, Droplet, Snowflake, 
  Wind, Compass, Map, MapPin, Navigation, Anchor, Ship, Rocket, Plane, Car, Bike, 
  Train, Bus, Truck, Coffee, CupSoda, Beer, Wine, Apple, Carrot, Citrus, Pizza, 
  Cake, Cookie, Croissant, IceCream, Music, Headphones, Mic, Radio, Tv, Monitor, 
  Laptop, Smartphone, Tablet, Watch, Camera, Video, Film, Clapperboard, 
  Image as ImageIcon, ImagePlus, Palette, Brush, Pen, PenTool, Highlighter, Scissors, 
  Hammer, Wrench, Bell, Axe, Pickaxe, Shovel, Sword, Shield, Clock, Crosshair, 
  Target, Trophy, Medal, Award, Crown, Gem, Diamond, Coins, Banknote, Wallet, 
  CreditCard, ShoppingCart, ShoppingBag, Gift, Package, Box, Archive, Book, 
  BookOpen, Bookmark, BookmarkPlus, Library, GraduationCap, School, Building, Home, 
  Tent, Castle, Factory, TreePine, TreeDeciduous, Leaf, Flower, Flower2, Sprout, 
  Bird, Cat, Dog, Rabbit, Turtle, Snail, Fish, Bug, Calendar, PawPrint, Footprints 
} from 'lucide-react';

export const PROFILE_COLORS = [
  { id: 'indigo', hex: 'bg-indigo-500', hover: 'hover:bg-indigo-600' },
  { id: 'blue', hex: 'bg-blue-500', hover: 'hover:bg-blue-600' },
  { id: 'sky', hex: 'bg-sky-500', hover: 'hover:bg-sky-600' },
  { id: 'cyan', hex: 'bg-cyan-500', hover: 'hover:bg-cyan-600' },
  { id: 'teal', hex: 'bg-teal-500', hover: 'hover:bg-teal-600' },
  { id: 'emerald', hex: 'bg-emerald-500', hover: 'hover:bg-emerald-600' },
  { id: 'green', hex: 'bg-green-500', hover: 'hover:bg-green-600' },
  { id: 'lime', hex: 'bg-lime-500', hover: 'hover:bg-lime-600' },
  { id: 'yellow', hex: 'bg-yellow-500', hover: 'hover:bg-yellow-600' },
  { id: 'amber', hex: 'bg-amber-500', hover: 'hover:bg-amber-600' },
  { id: 'orange', hex: 'bg-orange-500', hover: 'hover:bg-orange-600' },
  { id: 'red', hex: 'bg-red-500', hover: 'hover:bg-red-600' },
  { id: 'rose', hex: 'bg-rose-500', hover: 'hover:bg-rose-600' },
  { id: 'pink', hex: 'bg-pink-500', hover: 'hover:bg-pink-600' },
  { id: 'fuchsia', hex: 'bg-fuchsia-500', hover: 'hover:bg-fuchsia-600' },
  { id: 'purple', hex: 'bg-purple-500', hover: 'hover:bg-purple-600' },
  { id: 'violet', hex: 'bg-violet-500', hover: 'hover:bg-violet-600' },
  { id: 'slate', hex: 'bg-slate-500', hover: 'hover:bg-slate-600' },
];

export const PROFILE_ICONS = [
  { id: 'user', icon: User }, { id: 'users', icon: Users }, { id: 'smile', icon: Smile },
  { id: 'star', icon: Star }, { id: 'heart', icon: Heart }, { id: 'sun', icon: Sun },
  { id: 'moon', icon: Moon }, { id: 'cloud', icon: Cloud }, { id: 'zap', icon: Zap },
  { id: 'flame', icon: Flame }, { id: 'droplet', icon: Droplet }, { id: 'snowflake', icon: Snowflake },
  { id: 'wind', icon: Wind }, { id: 'compass', icon: Compass }, { id: 'map', icon: Map },
  { id: 'map-pin', icon: MapPin }, { id: 'navigation', icon: Navigation }, { id: 'anchor', icon: Anchor },
  { id: 'ship', icon: Ship }, { id: 'rocket', icon: Rocket }, { id: 'plane', icon: Plane },
  { id: 'car', icon: Car }, { id: 'bike', icon: Bike }, { id: 'train', icon: Train },
  { id: 'bus', icon: Bus }, { id: 'truck', icon: Truck }, { id: 'coffee', icon: Coffee },
  { id: 'cup-soda', icon: CupSoda }, { id: 'beer', icon: Beer }, { id: 'wine', icon: Wine },
  { id: 'apple', icon: Apple }, { id: 'carrot', icon: Carrot }, { id: 'citrus', icon: Citrus },
  { id: 'pizza', icon: Pizza }, { id: 'cake', icon: Cake }, { id: 'cookie', icon: Cookie },
  { id: 'croissant', icon: Croissant }, { id: 'ice-cream', icon: IceCream }, { id: 'music', icon: Music },
  { id: 'headphones', icon: Headphones }, { id: 'mic', icon: Mic }, { id: 'radio', icon: Radio },
  { id: 'tv', icon: Tv }, { id: 'monitor', icon: Monitor }, { id: 'laptop', icon: Laptop },
  { id: 'smartphone', icon: Smartphone }, { id: 'tablet', icon: Tablet }, { id: 'watch', icon: Watch },
  { id: 'camera', icon: Camera }, { id: 'video', icon: Video }, { id: 'film', icon: Film },
  { id: 'clapperboard', icon: Clapperboard }, { id: 'image', icon: ImageIcon }, { id: 'image-plus', icon: ImagePlus },
  { id: 'palette', icon: Palette }, { id: 'brush', icon: Brush }, { id: 'pen', icon: Pen },
  { id: 'pen-tool', icon: PenTool }, { id: 'highlighter', icon: Highlighter }, { id: 'scissors', icon: Scissors },
  { id: 'hammer', icon: Hammer }, { id: 'wrench', icon: Wrench }, { id: 'bell', icon: Bell },
  { id: 'axe', icon: Axe }, { id: 'pickaxe', icon: Pickaxe }, { id: 'shovel', icon: Shovel },
  { id: 'sword', icon: Sword }, { id: 'shield', icon: Shield }, { id: 'clock', icon: Clock },
  { id: 'crosshair', icon: Crosshair }, { id: 'target', icon: Target }, { id: 'trophy', icon: Trophy },
  { id: 'medal', icon: Medal }, { id: 'award', icon: Award }, { id: 'crown', icon: Crown },
  { id: 'gem', icon: Gem }, { id: 'diamond', icon: Diamond }, { id: 'coins', icon: Coins },
  { id: 'banknote', icon: Banknote }, { id: 'wallet', icon: Wallet }, { id: 'credit-card', icon: CreditCard },
  { id: 'shopping-cart', icon: ShoppingCart }, { id: 'shopping-bag', icon: ShoppingBag }, { id: 'gift', icon: Gift },
  { id: 'package', icon: Package }, { id: 'box', icon: Box }, { id: 'archive', icon: Archive },
  { id: 'book', icon: Book }, { id: 'book-open', icon: BookOpen }, { id: 'bookmark', icon: Bookmark },
  { id: 'bookmark-plus', icon: BookmarkPlus }, { id: 'library', icon: Library }, { id: 'graduation-cap', icon: GraduationCap },
  { id: 'school', icon: School }, { id: 'building', icon: Building }, { id: 'home', icon: Home },
  { id: 'tent', icon: Tent }, { id: 'castle', icon: Castle }, { id: 'factory', icon: Factory },
  { id: 'tree-pine', icon: TreePine }, { id: 'tree-deciduous', icon: TreeDeciduous }, { id: 'leaf', icon: Leaf },
  { id: 'flower', icon: Flower }, { id: 'flower2', icon: Flower2 }, { id: 'sprout', icon: Sprout },
  { id: 'bird', icon: Bird }, { id: 'cat', icon: Cat }, { id: 'dog', icon: Dog },
  { id: 'rabbit', icon: Rabbit }, { id: 'turtle', icon: Turtle }, { id: 'snail', icon: Snail },
  { id: 'fish', icon: Fish }, { id: 'bug', icon: Bug }, { id: 'calendar', icon: Calendar },
  { id: 'paw-print', icon: PawPrint }, { id: 'footprints', icon: Footprints }
];

// Higher-Order Component to create Lucide-compatible icons from text characters
const createHebrewIcon = (letter: string) => {
  const HebrewIcon = ({ size = 20, className = "" }: { size?: number, className?: string, strokeWidth?: number }) => (
    <span 
      style={{ fontSize: size * 0.95, width: size, height: size }} 
      className={`flex items-center justify-center font-serif font-black select-none leading-none pt-0.5 ${className}`}
    >
      {letter}
    </span>
  );
  return HebrewIcon;
};

export const HEBREW_ICONS = [
  { id: 'aleph', icon: createHebrewIcon('א') },
  { id: 'bet', icon: createHebrewIcon('ב') },
  { id: 'gimel', icon: createHebrewIcon('ג') },
  { id: 'dalet', icon: createHebrewIcon('ד') },
  { id: 'he', icon: createHebrewIcon('ה') },
  { id: 'vav', icon: createHebrewIcon('ו') },
  { id: 'zayin', icon: createHebrewIcon('ז') },
  { id: 'het', icon: createHebrewIcon('ח') },
  { id: 'tet', icon: createHebrewIcon('ט') },
  { id: 'yod', icon: createHebrewIcon('י') },
  { id: 'kaf', icon: createHebrewIcon('כ') },
  { id: 'kaf-final', icon: createHebrewIcon('ך') },
  { id: 'lamed', icon: createHebrewIcon('ל') },
  { id: 'mem', icon: createHebrewIcon('מ') },
  { id: 'mem-final', icon: createHebrewIcon('ם') },
  { id: 'nun', icon: createHebrewIcon('נ') },
  { id: 'nun-final', icon: createHebrewIcon('ן') },
  { id: 'samekh', icon: createHebrewIcon('ס') },
  { id: 'ayin', icon: createHebrewIcon('ע') },
  { id: 'pe', icon: createHebrewIcon('פ') },
  { id: 'pe-final', icon: createHebrewIcon('ף') },
  { id: 'tsadi', icon: createHebrewIcon('צ') },
  { id: 'tsadi-final', icon: createHebrewIcon('ץ') },
  { id: 'qof', icon: createHebrewIcon('ק') },
  { id: 'resh', icon: createHebrewIcon('ר') },
  { id: 'shin', icon: createHebrewIcon('ש') },
  { id: 'tav', icon: createHebrewIcon('ת') },
];

export const ALL_AVATAR_ICONS = [...PROFILE_ICONS, ...HEBREW_ICONS];