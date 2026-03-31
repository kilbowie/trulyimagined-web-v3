'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  UserCircle,
  CheckCircle,
  Clock,
  AlertCircle,
  MapPin,
  Mail,
  Calendar,
  Copy,
  Shield,
  Sparkles,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useState } from 'react';

interface ActorProfile {
  id: string;
  registryId?: string | null;
  email: string;
  firstName: string;
  lastName: string;
  stageName?: string;
  bio?: string;
  location?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  isVerified: boolean;
  isPro: boolean;
  verifiedAt?: string;
  isFoundingMember: boolean;
  createdAt: string;
}

interface RegistrationStatusProps {
  actor: ActorProfile;
}

export function RegistrationStatus({ actor }: RegistrationStatusProps) {
  const [copied, setCopied] = useState(false);
  const [showRegistryId, setShowRegistryId] = useState(false);

  const hasRegistryId = !!actor.registryId && actor.registryId.trim().length > 0;

  const maskRegistryId = (value: string) => {
    let visibleCharacters = 4;

    return value
      .split('')
      .reverse()
      .map((character) => {
        if (!/[A-Za-z0-9]/.test(character)) {
          return character;
        }

        if (visibleCharacters > 0) {
          visibleCharacters -= 1;
          return character;
        }

        return '•';
      })
      .reverse()
      .join('');
  };

  const displayRegistryId = hasRegistryId
    ? showRegistryId
      ? actor.registryId
      : maskRegistryId(actor.registryId)
    : 'Not assigned';

  const copyRegistryId = () => {
    if (!hasRegistryId) {
      return;
    }

    navigator.clipboard.writeText(actor.registryId!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusConfig = {
    pending: {
      icon: Clock,
      label: 'Verification Pending',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      description: 'Your registration is being reviewed',
    },
    verified: {
      icon: CheckCircle,
      label: 'Verified',
      color: 'bg-green-100 text-green-800 border-green-200',
      description: 'Your identity has been verified',
    },
    rejected: {
      icon: AlertCircle,
      label: 'Verification Failed',
      color: 'bg-red-100 text-red-800 border-red-200',
      description: 'Please contact support',
    },
  };

  const status = statusConfig[actor.verificationStatus];
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      {/* Registry ID Card - Prominent Display */}
      <Card className="border-2 border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Your Registry ID
          </CardTitle>
          <CardDescription>Your unique TrulyImagined identity reference</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-slate-950 text-white p-6 rounded-lg">
            <div className="space-y-2">
              <p className="text-sm text-slate-400">TrulyImagined Registry</p>
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold font-mono tracking-wider">{displayRegistryId}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={copyRegistryId}
                  disabled={!hasRegistryId}
                  className="flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <button
                type="button"
                onClick={() => setShowRegistryId((previous) => !previous)}
                disabled={!hasRegistryId}
                className="inline-flex items-center gap-2 text-xs text-slate-300 hover:text-white disabled:cursor-not-allowed disabled:text-slate-500"
              >
                {showRegistryId ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                {showRegistryId ? 'Hide Registry ID' : 'Click to Reveal Registry ID'}
              </button>
              <p className="text-xs text-slate-400">
                Use this ID to reference your identity across the platform
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusIcon className="h-5 w-5" />
              <div>
                <p className="text-sm font-medium">{status.label}</p>
                <p className="text-xs text-muted-foreground">{status.description}</p>
              </div>
            </div>
            <Badge variant="outline" className={status.color}>
              {actor.verificationStatus}
            </Badge>
          </div>

          {actor.isFoundingMember && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 p-3 rounded-lg">
              <p className="text-sm font-medium text-purple-900 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Founding Member
              </p>
              <p className="text-xs text-purple-700 mt-1">
                You're among the first to join the TrulyImagined Registry
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>Your registered identity details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                Verification Status
              </div>
              <Badge
                variant="outline"
                className={
                  actor.isVerified
                    ? 'border-green-500/50 text-green-700 dark:text-green-300'
                    : 'border-border text-muted-foreground'
                }
              >
                {actor.isVerified ? 'Verified' : 'Not Verified'}
              </Badge>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                Pro Status
              </div>
              <Badge
                variant="outline"
                className={
                  actor.isPro
                    ? 'border-amber-500/50 text-amber-700 dark:text-amber-300'
                    : 'border-border text-muted-foreground'
                }
              >
                {actor.isPro ? 'Pro Member' : 'Standard Member'}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Legal Name</p>
              <p className="text-base">
                {actor.firstName} {actor.lastName}
              </p>
            </div>

            {actor.stageName && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Stage Name</p>
                <p className="text-base">{actor.stageName}</p>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Email:</span>
              <span>{actor.email}</span>
            </div>

            {actor.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Location:</span>
                <span>{actor.location}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Registered:</span>
              <span>{new Date(actor.createdAt).toLocaleDateString()}</span>
            </div>

            {actor.verifiedAt && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Verified:</span>
                <span>{new Date(actor.verifiedAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {actor.bio && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Bio</p>
                <p className="text-sm">{actor.bio}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manage Your Identity</CardTitle>
          <CardDescription>Additional actions and settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start" disabled>
            <UserCircle className="mr-2 h-4 w-4" />
            Update Profile (Coming Soon)
          </Button>
          <Button variant="outline" className="w-full justify-start" asChild>
            <a href="/dashboard/verify-identity">
              <Shield className="mr-2 h-4 w-4" />
              Increase Verification Level
            </a>
          </Button>
          <Button variant="outline" className="w-full justify-start" asChild>
            <a href="/dashboard/verifiable-credentials">
              <CheckCircle className="mr-2 h-4 w-4" />
              Issue Credentials
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
