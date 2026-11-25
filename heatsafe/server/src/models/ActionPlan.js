import mongoose from 'mongoose';

const ITEM_STATUSES = ['Proposed', 'Planned', 'In progress', 'Completed', 'On hold'];

const actionPlanItemSchema = new mongoose.Schema(
  {
    assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment' },
    interventionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Intervention' },
    interventionName: { type: String, required: true },
    category: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0, default: 1 },
    unit: { type: String, default: 'unit' },
    estimatedUnitCost: { type: Number, required: true, min: 0 },
    estimatedTotalCost: { type: Number, required: true, min: 0 },
    priority: { type: Number, min: 1, default: 1 },
    status: { type: String, enum: ITEM_STATUSES, default: 'Proposed' },
    notes: { type: String, default: '' },
    targetDate: { type: Date },
    completedAt: { type: Date },
  },
  { _id: true }
);

const actionPlanSchema = new mongoose.Schema(
  {
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    budget: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    items: [actionPlanItemSchema],
    status: { type: String, enum: ['Draft', 'Active', 'Completed', 'Archived'], default: 'Draft' },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const ActionPlan = mongoose.model('ActionPlan', actionPlanSchema);
export { ITEM_STATUSES };
