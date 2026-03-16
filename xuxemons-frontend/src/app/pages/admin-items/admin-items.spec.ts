import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AdminItems } from './admin-items';
import { AdminService } from '../../core/services/admin';
import { AuthService } from '../../core/services/auth';

describe('AdminItems', () => {
  let component: AdminItems;
  let fixture: ComponentFixture<AdminItems>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminItems],
      providers: [
        provideHttpClient(),
        AdminService,
        AuthService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminItems);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
