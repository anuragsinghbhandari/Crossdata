import Razorpay from 'razorpay'
import { NextResponse } from 'next/server'

const keyId = process.env.RAZORPAY_KEY_ID
const keySecret = process.env.RAZORPAY_KEY_SECRET

if (!keyId || !keySecret) {
  throw new Error('Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET environment variables')
}

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
})

export async function POST(req: Request) {
  const body = await req.json()
  const amount = Number(body.amount)

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const order = await razorpay.orders.create({
    amount,
    currency: 'INR',
    payment_capture: true,
  })

  return NextResponse.json({
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    key_id: keyId,
  })
}
