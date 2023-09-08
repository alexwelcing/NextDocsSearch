import { NextRequest, NextResponse } from 'next/server';

const HOME_BUCKETS = ['index', 'chat'] as const;

function getBucket(buckets: typeof HOME_BUCKETS) {
  let n = cryptoRandom() * 100;
  let percentage = 100 / buckets.length;

  return (
    buckets.find(() => {
      n -= percentage;
      return n <= 0;
    }) ?? buckets[0]
  );
}

function cryptoRandom() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1);
}

export default function middleware(req: NextRequest) {
  const cookieName = 'ab-test-variant';
  let bucket = req.cookies.get(cookieName)?.value;
  let hasBucket = !!bucket;

  // If there's no active bucket in cookies or its value is invalid, get a new one
  if (!bucket || !HOME_BUCKETS.includes(bucket as any)) {
    bucket = getBucket(HOME_BUCKETS);
    hasBucket = false;
  }

  // Construct a fully qualified URL
  const urlBase = req.nextUrl.protocol + "://" + req.nextUrl.hostname;

  // Create a rewrite based on the bucket
  const res = bucket === 'chat'
    ? NextResponse.rewrite(`${urlBase}/chat`)
    : NextResponse.rewrite(`${urlBase}/`);

  // Set the bucket to the response cookies if it's not there or if its value was invalid
  if (!hasBucket) {
    res.cookies.set(cookieName, bucket);
  }

  return res;
}
