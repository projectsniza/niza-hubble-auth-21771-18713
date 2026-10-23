import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import OrganizationManagement from '@/components/settings/OrganizationManagement';
import UserManagement from '@/components/settings/UserManagement';
import MessageSettingsPanel from '@/components/messaging/MessageSettingsPanel';
import CustomRolesManagement from '@/components/settings/CustomRolesManagement';
import DocumentSettingsPanel from '@/components/settings/DocumentSettingsPanel';
import DepartmentManagement from '@/components/settings/DepartmentManagement';
import { Building2, Users, Lock, Eye, EyeOff, User, Loader2, MessageSquare, Shield, FileText, Briefcase } from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import CodeVerification from '@/components/auth/CodeVerification';
import { friendlyAuthError } from '@/lib/authErrors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { send2FACode, verify2FACode } from '@/lib/twoFactorAuth';

export default function Settings() {
  const { user, updatePassword } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [changeEmailStage, setChangeEmailStage] = useState<'email' | 'code'>('email');
  const [isRequestingEmailChange, setIsRequestingEmailChange] = useState(false);

  // Super Admin Password 2FA states
  const [password2FAOpen, setPassword2FAOpen] = useState(false);
  const [passwordChallengeToken, setPasswordChallengeToken] = useState<string | null>(null);
  const [isSendingPassword2FA, setIsSendingPassword2FA] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.name || '');
    }
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setIsUpdatingProfile(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: displayName.trim() })
        .eq('id', user?.id);

      if (error) throw error;

      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    // Super Admin 2-Step Mail Verification
    if (user?.role === 'super_admin') {
      if (!user.email) {
        toast.error('User email not found');
        return;
      }
      setIsChangingPassword(true);
      const res = await send2FACode(user.email, 'admin_password_change');
      setIsChangingPassword(false);
      if (!res.success || !res.challengeToken) {
        toast.error(res.error || 'Failed to send 2-step verification code');
        return;
      }
      setPasswordChallengeToken(res.challengeToken);
      setPassword2FAOpen(true);
      toast.info(`A 2-step verification code was sent to ${user.email}`);
      return;
    }

    setIsChangingPassword(true);

    const { error } = await updatePassword(newPassword);

    if (!error) {
      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      toast.error(error);
    }

    setIsChangingPassword(false);
  };

  const handleRequestEmailChange = async () => {
    const normalized = newEmail.trim().toLowerCase();
    if (!normalized || !/^\S+@\S+\.\S+$/.test(normalized)) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (normalized === user?.email?.toLowerCase()) {
      toast.error('This is already your current email address');
      return;
    }

    setIsRequestingEmailChange(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: normalized });
      if (error) {
        toast.error(friendlyAuthError(error.message));
        return;
      }
      setChangeEmailStage('code');
      toast.success(`Confirmation code sent to ${normalized}`);
    } finally {
      setIsRequestingEmailChange(false);
    }
  };

  const handleVerifyEmailChange = async (code: string): Promise<{ error: string | null }> => {
    const normalized = newEmail.trim().toLowerCase();
    const { error } = await supabase.auth.verifyOtp({
      email: normalized,
      token: code,
      type: 'email_change',
    });
    if (error) return { error: friendlyAuthError(error.message) };

    // Keep the app profile record in sync with the new login email
    try {
      await supabase.from('profiles').update({ email: normalized }).eq('id', user?.id);
    } catch {
      // Non-blocking: the profile record can be re-synced later
    }

    toast.success('Email updated successfully');
    setTimeout(() => window.location.reload(), 800);
    return { error: null };
  };

  const handleResendEmailChangeCode = async (): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim().toLowerCase() });
    return error ? { error: friendlyAuthError(error.message) } : { error: null };
  };

  // Check if user has access to organization/user management
  const isAdminOrHR = user?.role === 'super_admin' || user?.role === 'hr';
  const canManageOrgs = isAdminOrHR;
  const canManageUsers = isAdminOrHR;
  const canManageMessages = isAdminOrHR;
  const canManageCustomRoles = user?.role === 'super_admin'; // Only super admin manages custom roles
  const canManageDocuments = isAdminOrHR;
  const canManageDepartments = isAdminOrHR;

  // Show loading state while user is being fetched
  if (!user) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <NizaLoaderInline />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account and system settings</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="password" className="gap-2">
            <Lock className="h-4 w-4" />
            Password
          </TabsTrigger>
          {canManageOrgs && (
            <TabsTrigger value="organizations" className="gap-2">
              <Building2 className="h-4 w-4" />
              Organizations
            </TabsTrigger>
          )}
          {canManageUsers && (
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
          )}
          {canManageCustomRoles && (
            <TabsTrigger value="custom-roles" className="gap-2">
              <Shield className="h-4 w-4" />
              Custom Roles
            </TabsTrigger>
          )}
          {canManageMessages && (
            <TabsTrigger value="messages" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Messages
            </TabsTrigger>
          )}
          {canManageDocuments && (
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="h-4 w-4" />
              Documents
            </TabsTrigger>
          )}
          {canManageDepartments && (
            <TabsTrigger value="departments" className="gap-2">
              <Briefcase className="h-4 w-4" />
              Departments
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile" forceMount className="data-[state=inactive]:hidden">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle className="text-foreground">Profile Settings</CardTitle>
              <CardDescription>
                Update your profile information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">Email</Label>
                  <div className="flex gap-2">
                    <Input
                      id="email"
                      value={user?.email || ''}
                      disabled
                      className="bg-muted flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setChangeEmailOpen(true);
                        setChangeEmailStage('email');
                        setNewEmail('');
                      }}
                    >
                      Change
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Changing your email requires a 6-digit code sent to the new address
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name" className="text-foreground">Display Name</Label>
                  <Input
                    id="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Role</Label>
                  <Input
                    value={user?.role?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || ''}
                    disabled
                    className="bg-muted capitalize"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isUpdatingProfile}
                >
                  {isUpdatingProfile ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Profile'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Dialog
            open={changeEmailOpen}
            onOpenChange={(open) => {
              setChangeEmailOpen(open);
              if (!open) setChangeEmailStage('email');
            }}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Change email</DialogTitle>
                <DialogDescription>
                  {changeEmailStage === 'email'
                    ? 'We will send a 6-digit confirmation code to your new email address.'
                    : `Enter the code sent to ${newEmail.trim().toLowerCase()}`}
                </DialogDescription>
              </DialogHeader>
              {changeEmailStage === 'email' ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); handleRequestEmailChange(); }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="new-email">New email address</Label>
                    <Input
                      id="new-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="name@company.com"
                      disabled={isRequestingEmailChange}
                      autoFocus
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isRequestingEmailChange}>
                    {isRequestingEmailChange ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending code...
                      </>
                    ) : (
                      'Send confirmation code'
                    )}
                  </Button>
                </form>
              ) : (
                <CodeVerification
                  email={newEmail.trim().toLowerCase()}
                  title="Confirm your new email"
                  description="Enter the 6-digit code we sent"
                  onVerify={handleVerifyEmailChange}
                  onResend={handleResendEmailChangeCode}
                  onChangeEmail={() => setChangeEmailStage('email')}
                />
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="password" forceMount className="data-[state=inactive]:hidden">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle className="text-foreground">Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-foreground">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-foreground">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Super Admin 2FA Password Change Dialog */}
          <Dialog open={password2FAOpen} onOpenChange={setPassword2FAOpen}>
            <DialogContent className="sm:max-w-md p-6">
              <DialogHeader>
                <DialogTitle>Super Admin 2-Step Verification</DialogTitle>
                <DialogDescription>
                  Enter the 6-digit verification code sent to {user?.email} via Resend to authorize your password update.
                </DialogDescription>
              </DialogHeader>
              <CodeVerification
                email={user?.email || ''}
                title="Admin Security Check"
                description="Enter the 6-digit code sent to your email"
                onVerify={async (code) => {
                  if (!passwordChallengeToken) return { error: 'Verification session expired. Please retry.' };
                  const res = await verify2FACode(passwordChallengeToken, code, newPassword);
                  if (!res.success) {
                    if (res.challengeToken) setPasswordChallengeToken(res.challengeToken);
                    return { error: res.error || 'Invalid verification code' };
                  }
                  toast.success('Super Admin password updated successfully');
                  setPassword2FAOpen(false);
                  setNewPassword('');
                  setConfirmPassword('');
                  return { error: null };
                }}
                onResend={async () => {
                  if (!user?.email) return { error: 'User email not found' };
                  const res = await send2FACode(user.email, 'admin_password_change');
                  if (!res.success || !res.challengeToken) {
                    return { error: res.error || 'Failed to resend code' };
                  }
                  setPasswordChallengeToken(res.challengeToken);
                  return { error: null };
                }}
              />
            </DialogContent>
          </Dialog>
        </TabsContent>

        {canManageOrgs && (
          <TabsContent value="organizations" forceMount className="data-[state=inactive]:hidden">
            <OrganizationManagement />
          </TabsContent>
        )}

        {canManageUsers && (
          <TabsContent value="users" forceMount className="data-[state=inactive]:hidden">
            <UserManagement />
          </TabsContent>
        )}

        {canManageCustomRoles && (
          <TabsContent value="custom-roles" forceMount className="data-[state=inactive]:hidden">
            <CustomRolesManagement />
          </TabsContent>
        )}

        {canManageMessages && (
          <TabsContent value="messages" forceMount className="data-[state=inactive]:hidden">
            <MessageSettingsPanel />
          </TabsContent>
        )}

        {canManageDocuments && (
          <TabsContent value="documents" forceMount className="data-[state=inactive]:hidden">
            <DocumentSettingsPanel />
          </TabsContent>
        )}

        {canManageDepartments && (
          <TabsContent value="departments" forceMount className="data-[state=inactive]:hidden">
            <DepartmentManagement />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}