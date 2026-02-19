import { PrismaAdapter } from '@auth/prisma-adapter';
import { createId } from '@paralleldrive/cuid2';

const USERS = [

];

const seedUser = async (
  prisma,
  adapter,
  { email, providerAccountId, access_token, role, userName }
) => {
  const hasUser = await prisma.user.findUnique({
    where: { email },
  });
  if (hasUser) {
    console.warn(`${email} already exists and will not be seeded!`);
    return;
  }
  if (!hasUser && adapter.createUser) {
    const user = await adapter.createUser({
      id: createId(),
      email,
      emailVerified: new Date(),
    });
    await prisma.account.create({
      data: {
        userId: user.id,
        type: 'oauth',
        provider: 'google',
        providerAccountId,
        access_token,
        token_type: 'bearer',
        scope:
          'https://www.googleapis.com/auth/userinfo.email openid https://www.googleapis.com/auth/userinfo.profile',
        expires_at: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
      },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { name: userName, role },
    });
    console.log(`${email} has been seeded`);
  }
};

export const seedUsers = async (prisma) => {
  const adapter = PrismaAdapter(prisma);
  for (const user of USERS) {
    await seedUser(prisma, adapter, user);
  }
};
