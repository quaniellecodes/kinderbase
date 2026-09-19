import { getCredentials } from './actions';
import { CredentialsClient } from '@/components/credentials/CredentialsClient';

export default async function CredentialsPage() {
  const credentials = await getCredentials();
  return <CredentialsClient credentials={credentials} />;
}
