import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FilterXuxedex } from './filter-xuxedex';

describe('FilterXuxedex', () => {
  let component: FilterXuxedex;
  let fixture: ComponentFixture<FilterXuxedex>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilterXuxedex]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FilterXuxedex);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
