import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminNewXuxemon } from './admin-new-xuxemon';

describe('AdminNewXuxemon', () => {
  let component: AdminNewXuxemon;
  let fixture: ComponentFixture<AdminNewXuxemon>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminNewXuxemon]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminNewXuxemon);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
