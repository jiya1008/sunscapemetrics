import mongoose from 'mongoose';

const CATEGORIES = [
  'Shade structures',
  'Tree planting and vegetation',
  'Reflective or lighter-colored roofing',
  'Cool or lighter-colored paving',
  'Permeable surfaces or vegetation',
  'Outdoor seating or activity relocation',
  'Shade improvements for walkways',
  'Planting and landscape improvements',
];

const interventionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, enum: CATEGORIES },
    description: { type: String, required: true },
    rationale: { type: String, default: '' },
    suitableConditions: { type: String, default: '' },
    limitations: { type: String, default: '' },
    benefits: { type: String, default: '' },
    estimatedMinCost: { type: Number, required: true, min: 0 },
    estimatedMaxCost: { type: Number, required: true, min: 0 },
    unit: { type: String, default: 'per sq.m' },
    costAssumptions: { type: String, default: 'Illustrative planning estimate; verify locally.' },
    isCatalog: { type: Boolean, default: true },
  },
  { timestamps: true }
);

interventionSchema.index({ category: 1 });

export const Intervention = mongoose.model('Intervention', interventionSchema);
export { CATEGORIES };
