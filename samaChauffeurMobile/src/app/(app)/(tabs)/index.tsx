import React from 'react';
import { useAuth } from '@/context/AuthContext';
import PassengerHome from '@/components/passenger/PassengerHome';
import DriverHome from '@/components/driver/DriverHome';

export default function HomeTab() {
  const { mode } = useAuth();
  return mode === 'driver' ? <DriverHome /> : <PassengerHome />;
}
