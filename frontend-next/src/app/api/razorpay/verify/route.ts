import { NextResponse } from 'next/server'
import crypto from 'crypto'

const keySecret = process.env.RAZORPAY_KEY_SECRET
if (!keySecret) {
  throw new Error('Missing RAZORPAY_KEY_SECRET environment variable')
}

const KEY_SECRET = keySecret

export async function POST(req: Request) {
  const body = await req.json()
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: 'Missing verification payload' }, { status: 400 })
  }

  const generatedSignature = crypto
    .createHmac('sha256', KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex')

  if (generatedSignature !== razorpay_signature) {
    return NextResponse.json({ verified: false }, { status: 400 })
  }

  return NextResponse.json({ verified: true })
}
