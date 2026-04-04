'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AgentProfile {
  id: string;
  registry_id: string | null;
  agency_name: string;
  bio: string | null;
  profile_image_url: string | null;
  location: string | null;
  website_url: string | null;
  registered_company_name: string | null;
  company_registration_number: string | null;
  vat_number: string | null;
  registered_address_line1: string | null;
  registered_address_line2: string | null;
  registered_address_city: string | null;
  registered_address_postcode: string | null;
  registered_address_country: string | null;
  profile_completed: boolean;
  verification_status: string;
}

const initialForm = {
  agencyName: '',
  bio: '',
  profileImageUrl: '',
  location: '',
  websiteUrl: '',
  registeredCompanyName: '',
  companyRegistrationNumber: '',
  vatNumber: '',
  registeredAddressLine1: '',
  registeredAddressLine2: '',
  registeredAddressCity: '',
  registeredAddressPostcode: '',
  registeredAddressCountry: '',
};

export default function AgentProfilePage() {
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/agent-profile');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load agent profile');
        }

        setProfile(data.profile || null);
        if (data.profile) {
          setForm({
            agencyName: data.profile.agency_name || '',
            bio: data.profile.bio || '',
            profileImageUrl: data.profile.profile_image_url || '',
            location: data.profile.location || '',
            websiteUrl: data.profile.website_url || '',
            registeredCompanyName: data.profile.registered_company_name || '',
            companyRegistrationNumber: data.profile.company_registration_number || '',
            vatNumber: data.profile.vat_number || '',
            registeredAddressLine1: data.profile.registered_address_line1 || '',
            registeredAddressLine2: data.profile.registered_address_line2 || '',
            registeredAddressCity: data.profile.registered_address_city || '',
            registeredAddressPostcode: data.profile.registered_address_postcode || '',
            registeredAddressCountry: data.profile.registered_address_country || '',
          });
        }
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load agent profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const updateField = (field: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const uploadProfilePhoto = async (file: File) => {
    try {
      setUploadingPhoto(true);
      setError(null);
      setSuccess(null);

      const body = new FormData();
      body.append('file', file);

      const response = await fetch('/api/agent-profile/upload-photo', {
        method: 'POST',
        body,
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to upload profile photo');
      }

      setForm((current) => ({
        ...current,
        profileImageUrl: payload.profileImageUrl,
      }));

      setProfile((current) =>
        current
          ? {
              ...current,
              profile_image_url: payload.profileImageUrl,
            }
          : current
      );

      setSuccess('Profile photo uploaded successfully.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.agencyName.trim()) {
      setError('Agency name is required.');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/agent-profile', {
        method: profile ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save profile');
      }

      setProfile(data.profile);
      setSuccess(data.message || 'Agent profile saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground">Loading agency profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agency Profile</h1>
        <p className="text-muted-foreground mt-2">
          Complete your profile to appear in actor search and accept representation requests.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Profile Status
            <Badge variant={profile?.profile_completed ? 'default' : 'secondary'}>
              {profile?.profile_completed ? 'Complete' : 'Incomplete'}
            </Badge>
            {profile?.verification_status && (
              <Badge variant="outline" className="capitalize">
                {profile.verification_status}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Registry ID: {profile?.registry_id ? profile.registry_id : 'Will be assigned on creation'}
          </CardDescription>
        </CardHeader>
      </Card>

      {error && <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {success && <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div>}

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Details</CardTitle>
            <CardDescription>These details are visible to linked actors and admins.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 rounded-md border p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="h-20 w-20 rounded-full overflow-hidden border bg-muted flex items-center justify-center">
                  {form.profileImageUrl ? (
                    <img
                      src={form.profileImageUrl}
                      alt="Agency profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">No photo</span>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Profile Photo</p>
                  <p className="text-xs text-muted-foreground">
                    Upload a JPG, PNG, or WEBP image (max 10MB).
                  </p>
                  <Label htmlFor="profilePhotoUpload" className="sr-only">
                    Upload profile photo
                  </Label>
                  <input
                    id="profilePhotoUpload"
                    ref={photoInputRef}
                    type="file"
                    title="Upload profile photo"
                    aria-label="Upload profile photo"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="text-sm"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void uploadProfilePhoto(file);
                      }
                    }}
                    disabled={uploadingPhoto}
                  />
                  {uploadingPhoto && (
                    <p className="text-xs text-muted-foreground">Uploading photo...</p>
                  )}
                </div>
              </div>
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="agencyName">Agency Name *</Label>
              <Input
                id="agencyName"
                value={form.agencyName}
                onChange={(event) => updateField('agencyName', event.target.value)}
                placeholder="Example Talent Management"
                required
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="bio">Agency Bio</Label>
              <Textarea
                id="bio"
                value={form.bio}
                onChange={(event) => updateField('bio', event.target.value)}
                placeholder="Brief overview of your agency"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(event) => updateField('location', event.target.value)}
                placeholder="City, Country"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="websiteUrl">Website URL</Label>
              <Input
                id="websiteUrl"
                value={form.websiteUrl}
                onChange={(event) => updateField('websiteUrl', event.target.value)}
                placeholder="https://youragency.com"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registered Business Details</CardTitle>
            <CardDescription>
              Required for profile completion and commercial-readiness scaffolding.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="registeredCompanyName">Registered Company Name *</Label>
              <Input
                id="registeredCompanyName"
                value={form.registeredCompanyName}
                onChange={(event) => updateField('registeredCompanyName', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyRegistrationNumber">Company Registration Number *</Label>
              <Input
                id="companyRegistrationNumber"
                value={form.companyRegistrationNumber}
                onChange={(event) => updateField('companyRegistrationNumber', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vatNumber">VAT Number</Label>
              <Input
                id="vatNumber"
                value={form.vatNumber}
                onChange={(event) => updateField('vatNumber', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registeredAddressCountry">Country *</Label>
              <Input
                id="registeredAddressCountry"
                value={form.registeredAddressCountry}
                onChange={(event) => updateField('registeredAddressCountry', event.target.value)}
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="registeredAddressLine1">Address Line 1 *</Label>
              <Input
                id="registeredAddressLine1"
                value={form.registeredAddressLine1}
                onChange={(event) => updateField('registeredAddressLine1', event.target.value)}
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="registeredAddressLine2">Address Line 2</Label>
              <Input
                id="registeredAddressLine2"
                value={form.registeredAddressLine2}
                onChange={(event) => updateField('registeredAddressLine2', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registeredAddressCity">City *</Label>
              <Input
                id="registeredAddressCity"
                value={form.registeredAddressCity}
                onChange={(event) => updateField('registeredAddressCity', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registeredAddressPostcode">Postcode *</Label>
              <Input
                id="registeredAddressPostcode"
                value={form.registeredAddressPostcode}
                onChange={(event) => updateField('registeredAddressPostcode', event.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : profile ? 'Update Profile' : 'Create Profile'}
          </Button>
        </div>
      </form>
    </div>
  );
}
