import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const signature = request.headers.get('BTCPay-Sig');
  if (!signature) {
    return NextResponse.json({ ok: false, reason: 'Missing signature' }, { status: 401 });
  }

  const body = await request.text();

  if (!body || body.length < 10) {
    return NextResponse.json({ ok: false, reason: 'Invalid payload' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, event: 'InvoiceSettled', note: 'Prototype webhook accepted.' });
}
