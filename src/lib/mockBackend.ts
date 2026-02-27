import type { LoginCredentials, LoginResponse, TokenPair, User } from '../types';

// Mock user database
const MOCK_USERS: Array<{ email: string; password: string; user: User }> = [
  {
    email: 'demo@test.com',
    password: 'demo123',
    user: {
      id: 'user-001',
      email: 'demo@test.com',
      name: 'Demo User',
      role: 'user',
    },
  },
  {
    email: 'admin@test.com',
    password: 'admin123',
    user: {
      id: 'user-002',
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'admin',
    },
  },
];

// Map to track refresh tokens -> userId
const refreshTokenStore = new Map<string, string>();

function createJWT(payload: object, expiresInSeconds: number): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  // Mock signature (not real HMAC)
  const sig = encode({ mock: true, ts: now });
  return `${encode(header)}.${encode(fullPayload)}.${sig}`;
}

function generateRefreshToken(userId: string): string {
  const token = `refresh-${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  refreshTokenStore.set(token, userId);
  return token;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mockLogin(credentials: LoginCredentials): Promise<LoginResponse> {
  await delay(500);

  const match = MOCK_USERS.find(
    (u) => u.email === credentials.email && u.password === credentials.password,
  );

  if (!match) {
    throw new Error('Invalid email or password');
  }

  const token = createJWT(
    {
      sub: match.user.id,
      email: match.user.email,
      name: match.user.name,
      role: match.user.role,
    },
    3600, // 1 hour
  );

  const refreshToken = generateRefreshToken(match.user.id);

  return { token, refreshToken, user: match.user };
}

export async function mockRefreshToken(refreshToken: string): Promise<TokenPair> {
  await delay(300);

  const userId = refreshTokenStore.get(refreshToken);
  if (!userId) {
    throw new Error('Invalid or expired refresh token');
  }

  const match = MOCK_USERS.find((u) => u.user.id === userId);
  if (!match) {
    throw new Error('User not found');
  }

  // Invalidate old refresh token
  refreshTokenStore.delete(refreshToken);

  const newToken = createJWT(
    {
      sub: match.user.id,
      email: match.user.email,
      name: match.user.name,
      role: match.user.role,
    },
    3600,
  );

  const newRefreshToken = generateRefreshToken(userId);

  return { token: newToken, refreshToken: newRefreshToken };
}

export async function mockAIQuery(
  _docId: string,
  question: string,
): Promise<string> {
  await delay(200);

  const responses = [
    `Based on the document content, here is what I found regarding "${question}":\n\nThe document discusses several key points related to your query. The analysis shows that there are multiple perspectives to consider.\n\n**Key findings:**\n- The document provides detailed information on this topic\n- Several sections address this directly\n- Further context can be found in the appendix\n\nWould you like me to elaborate on any specific aspect?`,
    `Great question! Regarding "${question}", the document reveals:\n\n\`\`\`\n// Relevant excerpt from document\nSection 3.2: Analysis\nThis section covers the main aspects of the topic...\n\`\`\`\n\nThe document emphasizes the importance of understanding the broader context. The primary conclusion drawn is that this topic requires careful consideration of all available evidence.`,
    `Looking at the document in detail for "${question}":\n\nI found **3 relevant sections** that address this:\n\n1. **Introduction** - Provides background context\n2. **Methodology** - Explains the approach taken\n3. **Results** - Summarizes the findings\n\nThe overall conclusion suggests that the topic is multifaceted and requires a comprehensive approach.`,
    `The document contains valuable information about "${question}". Here is a summary:\n\nThe authors present a compelling argument that includes both quantitative and qualitative analysis. The key takeaway is that this area benefits from continued research and attention.\n\nFor more specific details, I'd recommend reviewing pages 3-7 of the document.`,
  ];

  const idx = Math.floor(Math.random() * responses.length);
  return responses[idx] ?? responses[0]!;
}
