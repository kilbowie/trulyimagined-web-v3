import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { redirect } from 'next/navigation';
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
} from 'lucide-react';

/**
 * Actor Profile Page (Spotlight CV Style)
 *
 * Displays comprehensive actor CV information in Spotlight format
 */
export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  const roles = await getUserRoles();
  const isActor = roles.includes('Actor');

  // Mock actor profile data - in production this would come from the actors table
  const actorProfile = {
    firstName: user.name?.split(' ')[0] || 'Actor',
    lastName: user.name?.split(' ').slice(1).join(' ') || 'Name',
    stageName: null,
    verified: false, // This would come from actors.verification_status === 'verified'
    registryId: '1234-5678-9012', // From actors.registry_id
    profileImage: user.picture,
    
    // Location & Basic Info
    location: 'London, England, United Kingdom',
    gender: 'Male',
    playingAgeMin: 25,
    playingAgeMax: 35,
    height: '5 feet 11 inches (180cm)',
    nationalities: ['British'],
    
    // Appearance
    appearance: 'White',
    eyeColour: 'Blue-Grey',
    hairColour: 'Light/Mid Brown',
    hairLength: 'Mid Length',
    facialHair: 'Beard',
    
    // Voice
    voiceStyles: ['Warm', 'Friendly'],
    vocalRange: 'E2 to C5',
    
    // Measurements
    chest: '40"',
    waist: '33"',
    hips: '36"',
    insideLeg: '32"',
    collar: '16"',
    shoeSize: '11',
    weight: '13 st 0 lb',
    
    // Memberships
    memberships: ['Equity', 'PRS', 'PPL'],
    
    // Biography
    bio: '',
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Actor Profile</h2>
          <p className="text-muted-foreground">Your professional CV and details</p>
        </div>
        {isActor && (
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
        )}
      </div>

      {!isActor ? (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Actor role required to view and edit profile details.
            </p>
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
                      <Avatar className="w-full h-auto aspect-[3/4] rounded-lg">
                        <AvatarImage 
                          src={actorProfile.profileImage || undefined} 
                          alt={`${actorProfile.firstName} ${actorProfile.lastName}`}
                          className="object-cover"
                        />
                        <AvatarFallback className="rounded-lg text-4xl">
                          {actorProfile.firstName[0]}{actorProfile.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Change
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Headshot photo
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
                    {/* Location */}
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Location:</p>
                      <p className="text-base">{actorProfile.location}</p>
                    </div>

                    {/* Gender */}
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Gender:</p>
                      <p className="text-base">{actorProfile.gender}</p>
                    </div>

                    {/* Playing Age */}
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Playing age:</p>
                      <p className="text-base">
                        {actorProfile.playingAgeMin} years to {actorProfile.playingAgeMax} years
                      </p>
                    </div>

                    {/* Height */}
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Height:</p>
                      <p className="text-base">{actorProfile.height}</p>
                    </div>

                    {/* Nationalities */}
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Nationalities:</p>
                      <p className="text-base">{actorProfile.nationalities.join(', ')}</p>
                    </div>

                    {/* Memberships */}
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Memberships:</p>
                      <p className="text-base">{actorProfile.memberships.join(', ')}</p>
                    </div>

                    {/* Appearance */}
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Appearance:</p>
                      <p className="text-base">{actorProfile.appearance}</p>
                    </div>

                    {/* Eye Colour */}
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Eye colour:</p>
                      <p className="text-base">{actorProfile.eyeColour}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Additional Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 sm:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Hair colour:</p>
                      <p className="text-base">{actorProfile.hairColour}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Hair length:</p>
                      <p className="text-base">{actorProfile.hairLength}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Facial hair:</p>
                      <p className="text-base">{actorProfile.facialHair}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Voice styles:</p>
                      <p className="text-base">{actorProfile.voiceStyles.join(', ')}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Vocal range:</p>
                      <p className="text-base">{actorProfile.vocalRange}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Chest:</p>
                      <p className="text-base">{actorProfile.chest}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Waist:</p>
                      <p className="text-base">{actorProfile.waist}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Hips:</p>
                      <p className="text-base">{actorProfile.hips}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Inside leg:</p>
                      <p className="text-base">{actorProfile.insideLeg}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Collar:</p>
                      <p className="text-base">{actorProfile.collar}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Shoe size:</p>
                      <p className="text-base">{actorProfile.shoeSize}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Weight:</p>
                      <p className="text-base">{actorProfile.weight}</p>
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
                    <p className="text-base leading-relaxed">{actorProfile.bio}</p>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No biography added yet</p>
                      <Button variant="outline" size="sm" className="mt-4">
                        <Edit className="mr-2 h-4 w-4" />
                        Add Biography
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Representation */}
              <Card>
                <CardHeader>
                  <CardTitle>Representation</CardTitle>
                  <CardDescription>Agent and management information</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">Coming Soon</p>
                    <p className="text-sm text-muted-foreground">
                      Agent representation features will be available in a future update
                    </p>
                  </div>
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
                      <p className="text-sm font-medium text-muted-foreground">Email Verification:</p>
                      <div className="flex items-center gap-2">
                        {user.email_verified ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-base text-green-600">Verified</span>
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4 text-yellow-600" />
                            <span className="text-base text-yellow-600">Not Verified</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Role:</p>
                      <Badge variant="secondary" className="text-sm">
                        <UserCircle className="h-3 w-3 mr-1" />
                        {roles.join(', ')}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Verification Status:</p>
                      <Badge 
                        variant={actorProfile.verified ? 'default' : 'outline'}
                        className="text-sm"
                      >
                        {actorProfile.verified ? 'Verified' : 'Pending'}
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
