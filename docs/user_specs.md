# Pill Counter - What the User Wants

## Who is this for?
Someone who needs to count pills in photos — pharmacist, lab technician, or anyone doing inventory.

## What does the user want to do?

### 1. Count pills from photos
- Give the app a photo (or a folder of photos)
- Get back the exact number of pills in each photo
- See the result visually: each pill marked with a red dot and a number

### 2. Get a report
- After processing, get a summary: how many pills in each image, total count
- Export results as a file (JSON) for records

### 3. Real scenarios
- Work with simple backgrounds (white paper, silver tray)
- Correctly count pills that are touching each other
- Background mostly simple, POC only
- only one type of pill per image (no need to differentiate types) -> so this more like an object counting problem, not classification

## What does the user NOT want?
- No web server or complex setup — just a command-line / jupyter notebook tool for POC first
- No AI/ML model downloads — works offline after install
- No need to count different pill types in one image
- No 3D/overlapping pill detection (stacked pills)

# Verification for algo
## Easy case
test0: 24 obj 
(not pills but there are 24 similar obj)
test1: 18 
test8: 23
test9: 6
test10: 12
test11: 7
test14: 8
test15: 50

## Hard case
test2: 28
test3: 23
test4: 23
test5: 25
test12: 10 (heavy reflection)
 
## Small mirror
test6: 21
test7: 30
