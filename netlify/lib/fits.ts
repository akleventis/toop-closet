import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { s3, tagOrphaned } from './s3.js'

// Each fit is its own object — independent keys, so concurrent creates/edits can't race.
// Storage contract shared by fits.ts (CRUD) and suitcases.ts (cascade delete).
const Bucket = process.env.S3_BUCKET_NAME
export const FITS_PREFIX = 'fits/items/'
export const fitKey = (id: string) => `${FITS_PREFIX}${id}.json`
export const fitImageKey = (id: string) => `clothing/fits-${id}.webp`

// Delete a fit's record and tag its 1:1 composite image for lifecycle expiry (best-effort tag).
export async function deleteFit(id: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket, Key: fitKey(id) }))
  await tagOrphaned(fitImageKey(id))
}
