import mongoose from 'mongoose';

const SURFACE_MATERIALS = [
  'Asphalt',
  'Concrete',
  'Dark paving',
  'Light or reflective paving',
  'Grass',
  'Soil',
  'Vegetated surface',
  'Mixed surface',
  'Other',
];

const LEVELS = ['Low', 'Medium', 'High'];
const RISK_LEVELS = ['Lower relative concern', 'Moderate relative concern', 'High relative concern', 'Very high relative concern'];

const assessmentSchema = new mongoose.Schema(
  {
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true, index: true },
    areaName: { type: String, required: true, trim: true },
    areaType: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    areaSize: { type: Number, min: 0 },
    surfaceMaterial: { type: String, required: true, enum: SURFACE_MATERIALS },
    shadeCoverage: { type: Number, required: true, min: 0, max: 100 },
    vegetationCoverage: { type: Number, required: true, min: 0, max: 100 },
    usageIntensity: { type: String, required: true, enum: LEVELS },
    exposureLevel: { type: String, required: true, enum: LEVELS },
    occupancy: { type: Number, min: 0 },
    observations: { type: String, trim: true, default: '' },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    riskScore: { type: Number, min: 0, max: 100 },
    riskLevel: { type: String, enum: RISK_LEVELS },
    scoreFactors: {
      shadeDeficiency: Number,
      vegetationDeficiency: Number,
      surfaceConcern: Number,
      exposureScore: Number,
      usageScore: Number,
      weighted: {
        shade: Number,
        surface: Number,
        exposure: Number,
        usage: Number,
        vegetation: Number,
      },
    },
    algorithmVersion: { type: String, default: '1.0' },
    assessedAt: { type: Date, default: Date.now },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

assessmentSchema.index({ riskScore: -1 });
assessmentSchema.index({ riskLevel: 1 });

export const Assessment = mongoose.model('Assessment', assessmentSchema);
export { SURFACE_MATERIALS, LEVELS, RISK_LEVELS };
