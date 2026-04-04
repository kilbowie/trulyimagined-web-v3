import Link from 'next/link';
import { ShieldOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface NoPermissionProps {
  feature?: string;
  agencyName?: string;
}

/**
 * Displayed when a team member navigates to a page they don't have permission for.
 */
export function NoPermission({ feature, agencyName }: NoPermissionProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="rounded-full bg-muted p-4">
              <ShieldOff className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <CardTitle className="text-xl">Access Restricted</CardTitle>
          <CardDescription>
            {feature
              ? `You don't have permission to access ${feature}.`
              : "You don't have permission to access this page."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            {agencyName
              ? `Please contact your Agency Admin at ${agencyName} to request access.`
              : 'Please contact your Agency Admin to request access.'}
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
