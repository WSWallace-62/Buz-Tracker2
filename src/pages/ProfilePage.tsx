// src/pages/ProfilePage.tsx

import { lazy } from 'react';

const UserProfile = lazy(() => import('../components/UserProfile').then(module => ({ default: module.UserProfile })));

export function ProfilePage() {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-900">Profile</h2>
      <div className="grid grid-cols-1 gap-8">
        <UserProfile />
      </div>
    </div>
  );
}
