import mongoose from 'mongoose';

const SITE_TYPES = [
  'College or university',
  'School',
  'Housing society',
  'Office',
  'Public or community facility',
  'Other',
];

const siteSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    type: { type: String, required: true, enum: SITE_TYPES },
    description: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: 'India' },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    totalArea: { type: Number, min: 0 },
    contactPerson: { type: String, trim: true, default: '' },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

siteSchema.index({ name: 'text', city: 'text', state: 'text' });
siteSchema.index({ type: 1 });

export const Site = mongoose.model('Site', siteSchema);
export { SITE_TYPES };
