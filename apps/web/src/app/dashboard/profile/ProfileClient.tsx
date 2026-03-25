'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  UserCircle,
  Shield,
  CheckCircle,
  Edit,
  Camera,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ActorMedia {
  id: string;
  media_type: string;
  file_name: string;
  s3_url: string;
  title: string | null;
  photo_credit: string | null;
  is_primary: boolean;
  display_order: number;
}

interface Actor {
  id: string;
  first_name: string;
  last_name: string;
  stage_name: string | null;
  email: string;
  location: string | null;
  bio: string | null;
  verification_status: string;
  registry_id: string;
  profile_image_url: string | null;
}

interface Auth0User {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
  [key: string]: unknown;
}

interface Props {
  user: Auth0User;
  roles: string[];
  actor: Actor | null;
  headshots: ActorMedia[];
}

export default function ProfileClient({ user, roles, actor, headshots: initialHeadshots }: Props) {
  const router = useRouter();
  const [headshots, setHeadshots] = useState<ActorMedia[]>(initialHeadshots);
  const [selectedHeadshotIndex, setSelectedHeadshotIndex] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isHeadshotSelectorOpen, setIsHeadshotSelectorOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [editForm, setEditForm] = useState({
    firstName: actor?.first_name || '',
    lastName: actor?.last_name || '',
    stageName: actor?.stage_name || '',
    location: actor?.location || '',
    bio: actor?.bio || '',
  });

  // Refresh headshots from API
  const refreshHeadshots = async () => {
    try {
      const response = await fetch('/api/media?type=headshot');
      const data = await response.json();
      if (data.success) {
        setHeadshots(data.media);
      }
    } catch (error) {
      console.error('Failed to refresh headshots:', error);
    }
  };

  const setPrimaryHeadshot = async (mediaId: string) => {
    try {
      const response = await fetch(`/api/media/${mediaId}/set-primary`, {
        method: 'PUT',
      });

      if (!response.ok) {
        throw new Error('Failed to set primary headshot');
      }

      await refreshHeadshots();
      setIsHeadshotSelectorOpen(false);
    } catch (error) {
      console.error('Error setting primary headshot:', error);
      alert('Failed to set primary headshot');
    }
  };

  const handleSaveProfile = async () => {
    if (!actor) return;

    try {
      // This endpoint needs to be created
      const response = await fetch(`/api/actors/${actor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          stageName: editForm.stageName || null,
          location: editForm.location,
          bio: editForm.bio,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      setIsEditDialogOpen(false);
      router.refresh();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    }
  };

  // Get primary and secondary headshots
  const primaryHeadshot = headshots.find((h) => h.is_primary) || headshots[0];
  const secondaryHeadshots = headshots
    .filter((h) => !h.is_primary)
    .sort((a, b) => a.display_order - b.display_order)
    .slice(0, 3);

  const actorProfile = {
    firstName: actor?.first_name || user.name?.split(' ')[0] || 'Actor',
    lastName: actor?.last_name || user.name?.split(' ').slice(1).join(' ') || 'Name',
    stageName: actor?.stage_name,
    verified: actor?.verification_status === 'verified',
    registryId: actor?.registry_id || 'Not Assigned',
    profileImage: primaryHeadshot?.s3_url || actor?.profile_image_url || user.picture,
    location: actor?.location || 'Not specified',
    bio: actor?.bio || '',
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Actor Profile</h2>
          <p className="text-muted-foreground">Your professional CV and details</p>
        </div>
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Edit className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>Update your profile information</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="stageName">Stage Name (optional)</Label>
                <Input
                  id="stageName"
                  value={editForm.stageName}
                  onChange={(e) => setEditForm({ ...editForm, stageName: e.target.value })}
                  placeholder="Leave blank to use legal name"
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  placeholder="e.g., London, England, United Kingdom"
                />
              </div>
              <div>
                <Label htmlFor="bio">Biography</Label>
                <Textarea
                  id="bio"
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  placeholder="Your professional background and experience"
                  rows={6}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveProfile}>Save Changes</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!actor ? (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <p className="text-sm mb-4">
              You haven't registered your actor identity yet. Please complete registration first.
            </p>
            <Button asChild>
              <Link href="/dashboard/register-identity">Register Identity</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Main Profile Grid */}
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            {/* Left Column - Photo & Quick Info */}
            <div className="space-y-6">
              {/* Profile Photo */}
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="relative group">
                      <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
                        <DialogTrigger asChild>
                          <div className="cursor-pointer">
                            <Avatar className="w-full h-auto aspect-[3/4] rounded-lg">
                              <AvatarImage
                                src={actorProfile.profileImage || undefined}
                                alt={`${actorProfile.firstName} ${actorProfile.lastName}`}
                                className="object-cover"
                              />
                              <AvatarFallback className="rounded-lg text-4xl">
                                {actorProfile.firstName[0]}
                                {actorProfile.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <div className="relative">
                            <img
                              src={
                                headshots[selectedHeadshotIndex]?.s3_url ||
                                actorProfile.profileImage
                              }
                              alt="Headshot"
                              className="w-full max-h-[70vh] object-contain"
                            />
                            {headshots.length > 1 && (
                              <>
                                <Button
                                  variant="secondary"
                                  size="icon"
                                  className="absolute left-4 top-1/2 -translate-y-1/2"
                                  onClick={() =>
                                    setSelectedHeadshotIndex((prev) =>
                                      prev === 0 ? headshots.length - 1 : prev - 1
                                    )
                                  }
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="icon"
                                  className="absolute right-4 top-1/2 -translate-y-1/2"
                                  onClick={() =>
                                    setSelectedHeadshotIndex((prev) =>
                                      prev === headshots.length - 1 ? 0 : prev + 1
                                    )
                                  }
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                          <div className="mt-4 space-y-2">
                            <p className="font-medium">
                              {headshots[selectedHeadshotIndex]?.title || 'Headshot'}
                            </p>
                            {headshots[selectedHeadshotIndex]?.photo_credit && (
                              <p className="text-sm text-muted-foreground">
                                Photo by: {headshots[selectedHeadshotIndex].photo_credit}
                              </p>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Dialog
                        open={isHeadshotSelectorOpen}
                        onOpenChange={setIsHeadshotSelectorOpen}
                      >
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Camera className="h-4 w-4 mr-2" />
                            Change
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>Select Headshot</DialogTitle>
                            <DialogDescription>
                              Choose from your uploaded headshots or{' '}
                              <Link
                                href="/dashboard/upload-media"
                                className="text-primary underline"
                              >
                                upload new ones
                              </Link>
                            </DialogDescription>
                          </DialogHeader>
                          {headshots.length === 0 ? (
                            <div className="text-center py-8">
                              <p className="text-muted-foreground mb-4">
                                No headshots uploaded yet
                              </p>
                              <Button asChild>
                                <Link href="/dashboard/upload-media">
                                  <Camera className="mr-2 h-4 w-4" />
                                  Upload Headshots
                                </Link>
                              </Button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-4">
                              {headshots.map((headshot) => (
                                <div
                                  key={headshot.id}
                                  className={`
                                    relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all
                                    ${
                                      headshot.is_primary
                                        ? 'border-primary ring-2 ring-primary ring-offset-2'
                                        : 'border-border hover:border-primary'
                                    }
                                  `}
                                  onClick={() => setPrimaryHeadshot(headshot.id)}
                                >
                                  <img
                                    src={headshot.s3_url}
                                    alt={headshot.title || 'Headshot'}
                                    className="aspect-[3/4] object-cover"
                                  />
                                  {headshot.is_primary && (
                                    <Badge className="absolute top-2 right-2">Primary</Badge>
                                  )}
                                  {headshot.title && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                      <p className="text-white text-xs">{headshot.title}</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Secondary Headshots Thumbnails */}
                    {secondaryHeadshots.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {secondaryHeadshots.map((headshot, index) => (
                          <div
                            key={headshot.id}
                            className="cursor-pointer rounded overflow-hidden border-2 border-border hover:border-primary transition-colors"
                            onClick={() => {
                              setSelectedHeadshotIndex(
                                headshots.findIndex((h) => h.id === headshot.id)
                              );
                              setIsGalleryOpen(true);
                            }}
                          >
                            <img
                              src={headshot.s3_url}
                              alt={headshot.title || `Headshot ${index + 2}`}
                              className="aspect-[3/4] object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground text-center">
                      {headshots.length === 0
                        ? 'No headshots uploaded'
                        : `${headshots.length} headshot${headshots.length > 1 ? 's' : ''}`}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Registry Info */}
              <Card className="bg-slate-950 text-white border-slate-800">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                      <Shield className="h-3 w-3" />
                      <span>REGISTRY ID</span>
                    </div>
                    <p className="font-mono text-lg font-bold tracking-wider">
                      {actorProfile.registryId}
                    </p>
                    <Separator className="bg-slate-800" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Status</span>
                      <Badge variant="outline" className="border-green-600 text-green-400 text-xs">
                        Active
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Details */}
            <div className="space-y-6">
              {/* Name & Verification */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-4xl flex items-center gap-3">
                    {actorProfile.stageName || `${actorProfile.firstName} ${actorProfile.lastName}`}
                    {actorProfile.verified && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-white" strokeWidth={3} />
                      </div>
                    )}
                  </CardTitle>
                  {actorProfile.stageName && (
                    <CardDescription className="text-base">
                      Legal name: {actorProfile.firstName} {actorProfile.lastName}
                    </CardDescription>
                  )}
                </CardHeader>
              </Card>

              {/* Details Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Location:</p>
                      <p className="text-base">{actorProfile.location}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Biography */}
              <Card>
                <CardHeader>
                  <CardTitle>Biography</CardTitle>
                  <CardDescription>Your professional background and experience</CardDescription>
                </CardHeader>
                <CardContent>
                  {actorProfile.bio ? (
                    <p className="text-base leading-relaxed whitespace-pre-wrap">
                      {actorProfile.bio}
                    </p>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No biography added yet</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => setIsEditDialogOpen(true)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Add Biography
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Account Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5" />
                    Account Information
                  </CardTitle>
                  <CardDescription>Your TrulyImagined account details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Email:</p>
                      <p className="text-base">{user.email}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Verification Status:
                      </p>
                      <Badge
                        variant={actorProfile.verified ? 'default' : 'outline'}
                        className="text-sm"
                      >
                        {actorProfile.verified ? 'Verified' : 'Pending'}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Role:</p>
                      <Badge variant="secondary" className="text-sm">
                        <UserCircle className="h-3 w-3 mr-1" />
                        {roles.join(', ')}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
