import { readFileSync } from 'fs'
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'

// Load .env.local without printing it
for (const line of readFileSync('/Users/alexleventis/dev/toop-closet/.env.local','utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g,'')
}
const Bucket = process.env.S3_BUCKET_NAME
const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
})
const readJson = async (Key) => {
  const r = await s3.send(new GetObjectCommand({ Bucket, Key }))
  return JSON.parse(await r.Body.transformToString())
}
const list = async (Prefix) => {
  const out = await s3.send(new ListObjectsV2Command({ Bucket, Prefix }))
  return (out.Contents ?? []).map(o => o.Key).filter(k => k.endsWith('.json'))
}

const suitcaseKeys = await list('suitcases/items/')
const suitcases = await Promise.all(suitcaseKeys.map(readJson))
const liveIds = new Set(suitcases.map(s => s.id))

const fitKeys = await list('fits/items/')
const fits = await Promise.all(fitKeys.map(readJson))
const withSuitcase = fits.filter(f => f.suitcaseId)
const orphans = withSuitcase.filter(f => !liveIds.has(f.suitcaseId))

console.log(`suitcases: ${suitcases.length}  |  fits total: ${fits.length}  |  fits with suitcaseId: ${withSuitcase.length}`)
console.log(`orphaned suitcase-fits (suitcaseId points at a deleted suitcase): ${orphans.length}`)
for (const f of orphans) console.log(`  - ${f.id}  "${f.name ?? '(unnamed)'}"  → missing suitcase ${f.suitcaseId}`)
