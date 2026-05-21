// Shared registry for niza-analysis till categories.
// Maps short Xero codes to human labels (used by UI + workbook).

export interface NizaCategoryMeta {
  code: string;
  label: string;
  vatType?: 'standard' | 'zero' | 'reduced';
}

export const NIZA_CATEGORIES: NizaCategoryMeta[] = [
  { code: 'FU', label: 'Fuel', vatType: 'standard' },
  { code: 'TO', label: 'Tobacco', vatType: 'standard' },
  { code: 'DR', label: 'Drinks', vatType: 'standard' },
  { code: 'GS', label: 'Grocery Standard', vatType: 'standard' },
  { code: 'GZ', label: 'Grocery Zero', vatType: 'zero' },
  { code: 'DO', label: 'Domestic 5%', vatType: 'reduced' },
  { code: 'AL', label: 'Alcohol', vatType: 'standard' },
  { code: 'NP', label: 'Newspapers', vatType: 'zero' },
  { code: 'VM', label: 'Vending', vatType: 'standard' },
  { code: 'CW', label: 'Car/Jet Wash', vatType: 'standard' },
];

export const CODE_TO_LABEL: Record<string, string> = Object.fromEntries(
  NIZA_CATEGORIES.map(c => [c.code, c.label])
);
