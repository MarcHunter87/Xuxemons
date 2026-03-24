import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { AdminEditEvolve } from './admin-edit-evolve';

describe('AdminEditEvolve', () => {
  let component: AdminEditEvolve;
  let fixture: ComponentFixture<AdminEditEvolve>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminEditEvolve, HttpClientTestingModule, RouterTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: (k: string) => (k === 'id' ? '1' : null) } },
          },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminEditEvolve);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
