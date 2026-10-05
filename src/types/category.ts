export type Category = {
  id: string;
  name: string;
  /** Key into the lucide icon registry (see components/ui/Icon.tsx). */
  icon: string;
  /** Both themes are stored so categories stay correct when the scheme changes. */
  colorLight: string;
  colorDark: string;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
};

export type CategoryColor = { light: string; dark: string };