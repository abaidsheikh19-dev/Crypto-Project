export async function GET() {
  return Response.json({
    ok: true,
    service: 'crypto-payment-store',
    status: 'healthy'
  });
}
