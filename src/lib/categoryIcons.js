import {
  Backpack,
  Bike,
  BookOpen,
  Calculator,
  FileText,
  Gem,
  Glasses,
  Headphones,
  IdCard,
  KeyRound,
  Laptop,
  Package,
  PenTool,
  Shirt,
  Smartphone,
  Umbrella,
  Wallet,
  Watch,
} from 'lucide-react';

/**
 * Icons an admin can assign to a category (stored by name in
 * item_categories.icon). Explicit imports keep the bundle small.
 */
export const CATEGORY_ICONS = {
  Smartphone,
  Laptop,
  Headphones,
  IdCard,
  Wallet,
  Backpack,
  Shirt,
  BookOpen,
  Calculator,
  PenTool,
  Watch,
  Glasses,
  Umbrella,
  KeyRound,
  FileText,
  Gem,
  Bike,
  Package,
};

export const categoryIcon = (name) => CATEGORY_ICONS[name] ?? Package;
