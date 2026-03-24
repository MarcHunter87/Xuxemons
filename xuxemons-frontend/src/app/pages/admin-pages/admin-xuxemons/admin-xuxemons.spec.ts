import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AdminXuxemons } from './admin-xuxemons';
import { AdminService } from '../../../core/services/admin';
import { AuthService } from '../../../core/services/auth';

describe('AdminXuxemons', () => {
  let component: AdminXuxemons;
  let fixture: ComponentFixture<AdminXuxemons>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminXuxemons],
      providers: [
        provideHttpClient(),
        AdminService,
        AuthService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminXuxemons);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
