import Constants from 'expo-constants';
import { api } from '@/lib/api';

api.setDevelopmentHostUri(__DEV__ ? Constants.expoConfig?.hostUri : null);
