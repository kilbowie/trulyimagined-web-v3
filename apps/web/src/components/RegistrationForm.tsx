'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface RegistrationFormProps {
  userEmail?: string;
  userName?: string;
}

export function RegistrationForm({ userEmail, userName }: RegistrationFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    firstName: userName?.split(' ')[0] || '',
    lastName: userName?.split(' ').slice(1).join(' ') || '',
    stageName: '',
    location: '',
    bio: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/identity/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        // Provide more detailed error messages
        if (response.status === 409) {
          throw new Error('You are already registered. Please refresh the page.');
        } else if (response.status === 403) {
          throw new Error('Actor role required. Please contact support.');
        } else if (response.status === 500) {
          throw new Error(
            `Server error: ${data.message || 'An unexpected error occurred. Please try again or contact support if the problem persists.'}`
          );
        }
        throw new Error(data.error || `Registration failed (${response.status})`);
      }

      setSuccess(true);
      // Redirect after short delay
      setTimeout(() => {
        router.push('/dashboard/register-identity');
        router.refresh();
      }, 2000);
    } catch (err: unknown) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'Failed to register. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Registration Successful!</h3>
              <p className="text-muted-foreground">
                Welcome to the TrulyImagined Identity Registry
              </p>
              <p className="text-sm text-muted-foreground">Redirecting...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register Your Identity</CardTitle>
        <CardDescription>
          Complete this form to create your unique Registry profile
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Registration Error</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="firstName" className="text-sm font-medium">
                First Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                required
                value={formData.firstName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="John"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="lastName" className="text-sm font-medium">
                Last Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                required
                value={formData.lastName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Smith"
              />
            </div>
          </div>

          {/* Stage Name */}
          <div className="space-y-2">
            <label htmlFor="stageName" className="text-sm font-medium">
              Stage Name / Professional Name
            </label>
            <input
              type="text"
              id="stageName"
              name="stageName"
              value={formData.stageName}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Optional - e.g., 'John Sterling'"
            />
            <p className="text-xs text-muted-foreground">
              If you perform under a different name, enter it here
            </p>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label htmlFor="location" className="text-sm font-medium">
              Location
            </label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g., London, UK or Los Angeles, CA"
            />
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <label htmlFor="bio" className="text-sm font-medium">
              Professional Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Tell us about your professional background and experience..."
            />
            <p className="text-xs text-muted-foreground">Optional - visible in your profile</p>
          </div>

          <Separator />

          {/* Email Display */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium">Account Email</p>
            <p className="text-sm text-muted-foreground">{userEmail}</p>
            <p className="text-xs text-muted-foreground">
              This email from your Auth0 account will be associated with your registry profile
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering...
                </>
              ) : (
                'Complete Registration'
              )}
            </Button>
            <Button type="button" variant="outline" asChild>
              <a href="/dashboard">Cancel</a>
            </Button>
          </div>

          {/* Privacy Notice */}
          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
            <p>
              By registering, you confirm that the information provided is accurate and you agree
              to the TrulyImagined Terms of Service and Privacy Policy. Your Registry ID will be
              permanently associated with your account.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
