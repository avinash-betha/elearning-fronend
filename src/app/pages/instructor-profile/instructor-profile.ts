import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CourseRatingsService } from '../../services/course-ratings.service';
import { CourseService } from '../../services/course.service';

interface InstructorCourseCard {
  id: number;
  title: string;
  category: string;
  rating: number;
  students: number;
  price: string;
}

@Component({
  selector: 'app-instructor-profile',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './instructor-profile.html',
  styleUrls: ['./instructor-profile.css']
})
export class InstructorProfile implements OnInit {
  instructorEmail = '';
  name = '';
  bio = '';
  profilePhotoDataUrl = '';

  courses: InstructorCourseCard[] = [];

  constructor(
    private route: ActivatedRoute,
    private coursesService: CourseService,
    private ratings: CourseRatingsService
  ) {}

  async ngOnInit(): Promise<void> {
    this.instructorEmail = this.route.snapshot.paramMap.get('email') || '';

    const email = String(this.instructorEmail || '').trim().toLowerCase();
    if (!email) return;

    const allCourses = await this.coursesService.listAllCourses();
    const mine = allCourses.filter((c) => String(c.instructorEmail || '').toLowerCase() === email);
    this.name = mine[0]?.instructorName || 'Instructor';
    this.bio = mine.length > 0 ? 'Instructor profile' : 'Instructor profile will be available soon.';
    this.profilePhotoDataUrl = '';

    const cards = await Promise.all(
      mine.map(async (c) => {
        const summary = await this.ratings.getSummary(String(c.id));
        return {
          id: Number(c.id),
          title: c.title,
          category: c.category,
          rating: summary.average,
          students: summary.count,
          price: c.isFree ? 'Free' : `$${(c.priceCents / 100).toFixed(2)}`
        };
      })
    );
    this.courses = cards;
  }
}



