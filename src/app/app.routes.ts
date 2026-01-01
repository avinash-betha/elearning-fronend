import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';

// Public pages
import { Home } from './pages/home/home';
import { Login } from './pages/login/login';
import { Signup } from './pages/signup/signup';
import { Courses } from './pages/courses/courses';
import { CourseDetails } from './pages/course-details/course-details';
import { Cart } from './pages/cart/cart';

// Protected pages
import { Dashboard } from './pages/dashboard/dashboard';
import { EnrolledCourses } from './pages/enrolled-courses/enrolled-courses';
import { CourseContent } from './pages/course-content/course-content';
import { InstructorDashboard } from './pages/instructor-dashboard/instructor-dashboard';
import { AdminDashboard } from './pages/admin-dashboard/admin-dashboard';
import { CreateCourse } from './pages/create-course/create-course';
import { Profile } from './pages/profile/profile';
import { ApplyInstructor } from './pages/apply-instructor/apply-instructor';
import { InstructorProfile } from './pages/instructor-profile/instructor-profile';
import { SupportChat } from './pages/support-chat/support-chat';
import { FinalExamPage } from './pages/final-exam/final-exam';
import { VerifyCertificatePage } from './pages/verify-certificate/verify-certificate';
import { SkillsPathPage } from './pages/skills-path/skills-path';
import { CourseProjectPage } from './pages/course-project/course-project';
import { CohortPage } from './pages/cohort/cohort';

export const routes: Routes = [
  // Public Routes
  { path: '', component: Home },
  { path: 'login', component: Login },
  { path: 'signup', component: Signup },
  { path: 'courses', component: Courses },
  { path: 'courses/:id', component: CourseDetails },
  { path: 'cart', component: Cart },
  { path: 'instructors/:email', component: InstructorProfile },

  // Protected Routes (require authentication)
  {
    path: 'dashboard',
    component: Dashboard,
    canActivate: [roleGuard(['student'])]
  },
  {
    path: 'enrolled-courses',
    component: EnrolledCourses,
    canActivate: [roleGuard(['student'])]
  },
  {
    path: 'course-content',
    component: CourseContent,
    // Public to support preview lessons; the page enforces locked lessons when logged out.
  },
  {
    path: 'profile',
    component: Profile,
    canActivate: [authGuard]
  },
  {
    path: 'support',
    component: SupportChat,
    canActivate: [authGuard]
  },
  {
    path: 'exam/:courseId',
    component: FinalExamPage,
    canActivate: [roleGuard(['student'])]
  },
  {
    path: 'skills-path/:courseId',
    component: SkillsPathPage,
    canActivate: [roleGuard(['student'])]
  },
  {
    path: 'course-project/:courseId',
    component: CourseProjectPage,
    canActivate: [roleGuard(['student', 'instructor'])]
  },
  {
    path: 'cohort/:courseId',
    component: CohortPage,
    canActivate: [roleGuard(['student'])]
  },
  {
    path: 'verify-certificate/:id',
    component: VerifyCertificatePage
  },
  {
    path: 'apply-instructor',
    component: ApplyInstructor,
    canActivate: [roleGuard(['student'])]
  },
  {
    path: 'instructor',
    component: InstructorDashboard,
    canActivate: [roleGuard(['instructor'])]
  },
  {
    path: 'instructor/create-course',
    component: CreateCourse,
    canActivate: [roleGuard(['instructor'])]
  },
  {
    path: 'instructor/edit-course/:id',
    component: CreateCourse,
    canActivate: [roleGuard(['instructor'])]
  },
  {
    path: 'admin',
    component: AdminDashboard,
    canActivate: [roleGuard(['admin'])]
  },

  // Redirect unknown routes to home
  { path: '**', redirectTo: '' }
];
